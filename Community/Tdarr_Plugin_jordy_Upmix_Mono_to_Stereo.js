const details = () => ({
  id: 'Tdarr_Plugin_jordy_Upmix_Mono_to_Stereo',
  Stage: 'Pre-processing',
  Name: 'Upmix Mono Audio Tracks to Stereo',
  Type: 'Audio',
  Operation: 'Transcode',
  Description: 'This plugin converts mono audio tracks to stereo format using a high-quality upmixing algorithm. \n\n',
  Version: '1.1',
  Link: "https://github.com/jordanlambrecht",
  Tags: 'pre-processing,ffmpeg,audio only,configurable',
  Inputs: [
    {
      name: 'codecs',
      type: 'string',
      defaultValue: 'all',
      inputUI: {
        type: 'text',
      },
      tooltip: `Enter comma-separated list of audio codecs to process or 'all' for all codecs.
               \\nExample:\\n
               all
               
               \\nExample:\\n
               aac,mp3
               
               \\nExample:\\n
               ac3,eac3,dts`,
    },
    {
      name: 'extrastereo_amount',
      type: 'string',
      defaultValue: '1.7',
      inputUI: {
        type: 'text',
      },
      tooltip: `Set the stereo enhancement level (1.0-2.5).
               Higher values create more separation but may sound artificial.
               1.0 = no enhancement, 1.7 = recommended for most content
               \\nExample:\\n
               1.7
               
               \\nExample:\\n
               2.0`,
    },
    {
      name: 'audio_bitrate',
      type: 'string',
      defaultValue: '192',
      inputUI: {
        type: 'dropdown',
        options: [
          'Keep Original',
          '128',
          '160',
          '192',
          '224',
          '256',
          '320'
        ],
      },
      tooltip: `Select output audio bitrate in kbps.
               'Keep Original' will attempt to maintain the same bitrate as the source.
               Higher values provide better quality but larger file size.
               192 is recommended for most content.`,
    },
    {
      name: 'remove_original',
      type: 'boolean',
      defaultValue: true,
      inputUI: {
        type: 'dropdown',
        options: [
          'true',
          'false'
        ],
      },
      tooltip: `Choose whether to remove the original mono tracks.
               true = Only keep the new stereo tracks
               false = Keep both mono and stereo tracks
               \\nExample:\\n
               true`,
    },
    {
      name: 'languages',
      type: 'string',
      defaultValue: '',
      inputUI: {
        type: 'text',
      },
      tooltip: `Enter comma-separated list of language tags to filter (leave blank to process all languages).
               Must follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
               \\nExample:\\n
               eng
               
               \\nExample:\\n
               jpn,kor`,
    }
  ],
});

const plugin = (file, librarySettings, inputs, otherArguments) => {
  const lib = require('../methods/lib')();
  inputs = lib.loadDefaultValues(inputs, details);
  
  const response = {
    processFile: false,
    preset: '',
    container: `.${file.container}`,
    handBrakeMode: false,
    FFmpegMode: true,
    reQueueAfter: false,
    infoLog: '',
  };

  // Check if file is a video
  if (file.fileMedium !== 'video') {
    response.infoLog += '☒ File is not video \n';
    response.processFile = false;
    return response;
  }

  // Parse inputs with safety checks
  const codecs = inputs.codecs ? inputs.codecs.toLowerCase().trim() : 'all';
  const codecsToProcess = codecs === 'all' ? [] : 
                          codecs.split(',').map(codec => codec.trim()).filter(codec => codec !== '');
  
  const extrastereoAmount = parseFloat(inputs.extrastereo_amount || '1.7');
  // Clamp to reasonable range
  const safeExtrastereoAmount = Math.min(Math.max(extrastereoAmount, 1.0), 2.5);
  
  const useOriginalBitrate = inputs.audio_bitrate === 'Keep Original';
  const audioBitrate = useOriginalBitrate ? 0 : parseInt(inputs.audio_bitrate || '192', 10);
  // Ensure valid bitrate if not using original
  const safeAudioBitrate = useOriginalBitrate ? 0 : 
                         ([128, 160, 192, 224, 256, 320].includes(audioBitrate) ? audioBitrate : 192);
  
  // Parse remove_original option
  const removeOriginal = inputs.remove_original === true || inputs.remove_original === 'true';
  
  // Parse language tags
  const languagesToProcess = ((inputs.languages || '').toLowerCase().split(',')
    .map(lang => lang.trim())
    .filter(lang => lang !== ''));
  
  // Log input parameters
  response.infoLog += `ℹ️ Parameters: Codecs=${codecs}, Enhancement=${safeExtrastereoAmount}, `;
  response.infoLog += `Bitrate=${useOriginalBitrate ? 'Keep Original' : safeAudioBitrate + 'k'}, `;
  response.infoLog += `Remove Original=${removeOriginal}, `;
  response.infoLog += `Languages=${languagesToProcess.length > 0 ? languagesToProcess.join(',') : 'all'}\n`;
  
  // Store all audio streams and their properties for reference
  const audioStreams = [];
  const monoStreamsToConvert = [];
  
  // Loop through all streams to identify audio streams and mono tracks to convert
  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    const stream = file.ffProbeData.streams[i];
    
    // Check if stream is audio
    if (stream.codec_type && stream.codec_type.toLowerCase() === 'audio') {
      // Build a stream info object
      const streamInfo = {
        index: i,
        absoluteIndex: i,  // Preserve the absolute stream index for FFmpeg
        audioIndex: audioStreams.length,  // Track audio stream position
        codec: stream.codec_name ? stream.codec_name.toLowerCase() : '',
        channels: stream.channels || 0,
        bitrate: 0,
        language: '',
        title: '',
        default: stream.disposition?.default === 1,
        isMonoToConvert: false
      };
      
      // Get bitrate if available
      try {
        if (stream.bit_rate) {
          streamInfo.bitrate = Math.round(parseInt(stream.bit_rate, 10) / 1000);
        }
      } catch (err) {
        // Bitrate info not available, use default
        streamInfo.bitrate = safeAudioBitrate;
      }
      
      // Get language tag
      try {
        if (stream.tags && stream.tags.language) {
          streamInfo.language = stream.tags.language;
        }
      } catch (err) {
        // Language tag doesn't exist
      }
      
      // Get title tag
      try {
        if (stream.tags && stream.tags.title) {
          streamInfo.title = stream.tags.title;
        }
      } catch (err) {
        // Title tag doesn't exist
      }
      
      // Check if this is a mono track to convert
      if (streamInfo.channels === 1) {
        // Check if we should process this track based on codec and language filters
        const codecMatches = codecs === 'all' || codecsToProcess.includes(streamInfo.codec);
        const languageMatches = languagesToProcess.length === 0 || 
                              (streamInfo.language && languagesToProcess.includes(streamInfo.language.toLowerCase()));
        
        if (codecMatches && languageMatches) {
          streamInfo.isMonoToConvert = true;
          monoStreamsToConvert.push(streamInfo);
          
          response.infoLog += `☑ Will convert: audio track ${i} (${streamInfo.codec}, ${streamInfo.language || 'unknown'} language`;
          if (streamInfo.bitrate) {
            response.infoLog += `, ${streamInfo.bitrate}k`;
          }
          if (streamInfo.title) {
            response.infoLog += `, "${streamInfo.title}"`;
          }
          response.infoLog += `)\n`;
        } else {
          response.infoLog += `ℹ️ Skipping: mono track ${i} - doesn't match filters\n`;
        }
      } else {
        response.infoLog += `ℹ️ Skipping: audio track ${i} - already has ${streamInfo.channels} channels\n`;
      }
      
      // Add to audio streams array
      audioStreams.push(streamInfo);
    }
  }
  
  // Process file if mono tracks found to convert
  if (monoStreamsToConvert.length > 0) {
    response.processFile = true;
    
    // Build the FFmpeg command properly
    // Start with a filter complex array for better maintainability
    const filterComplex = [];
    
    // For each mono stream to convert, add a filter chain
    monoStreamsToConvert.forEach((stream, idx) => {
      filterComplex.push(
        `[0:${stream.absoluteIndex}]` +
        `aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,` +
        `extrastereo=m=${safeExtrastereoAmount}` +
        `[stereo${idx}]`
      );
    });
    
    // Now build the full command
    let ffmpegCommandInsert = '';
    
    // Add filter complex if we have filters
    if (filterComplex.length > 0) {
      ffmpegCommandInsert += `-filter_complex "${filterComplex.join(';')}" `;
    }
    
    // Map all original streams
    ffmpegCommandInsert += `-map 0 `;
    
    // If removing originals, remove the mono streams we're converting
    if (removeOriginal) {
      monoStreamsToConvert.forEach(stream => {
        ffmpegCommandInsert += `-map -0:${stream.absoluteIndex} `;
      });
    }
    
    // Add converted stereo streams
    monoStreamsToConvert.forEach((stream, idx) => {
      ffmpegCommandInsert += `-map "[stereo${idx}]" `;
    });
    
    // Copy all non-modified streams
    ffmpegCommandInsert += `-c copy `;
    
    // Handle the new stereo streams
    monoStreamsToConvert.forEach((stream, idx) => {
      // Calculate the output stream index based on mappings
      // This is complex because the index depends on whether we're removing originals
      // and how many streams we've already processed
      
      // New streams will be added at the end, so we need to determine the index
      ffmpegCommandInsert += `-c:a:#STREAMIDX# aac `;
      
      // Set bitrate for each new stream
      if (useOriginalBitrate) {
        ffmpegCommandInsert += `-b:a:#STREAMIDX# ${stream.bitrate || safeAudioBitrate}k `;
      } else {
        ffmpegCommandInsert += `-b:a:#STREAMIDX# ${safeAudioBitrate}k `;
      }
      
      // Preserve all metadata
      if (stream.language) {
        ffmpegCommandInsert += `-metadata:s:a:#STREAMIDX# language=${stream.language} `;
      }
      
      if (stream.title) {
        // Create a new title that indicates it's stereo
        const newTitle = stream.title.includes('Stereo') ? 
                        stream.title : 
                        `${stream.title} (Stereo)`;
        ffmpegCommandInsert += `-metadata:s:a:#STREAMIDX# title="${newTitle}" `;
      } else {
        // Add a basic title if none exists
        ffmpegCommandInsert += `-metadata:s:a:#STREAMIDX# title="Stereo" `;
      }
      
      // Make the first converted stream default if the original was default
      if (stream.default) {
        ffmpegCommandInsert += `-disposition:a:#STREAMIDX# default `;
      }
    });
    
    // Replace the stream index placeholder with actual indices
    // This is safer than trying to calculate indices in advance
    ffmpegCommandInsert = ffmpegCommandInsert.replace(/#STREAMIDX#/g, 'a');
    
    response.preset = `, ${ffmpegCommandInsert}`;
    response.infoLog += `✅ Will convert ${monoStreamsToConvert.length} mono track(s) to stereo\n`;
    response.infoLog += `${removeOriginal ? '🔄 Original mono tracks will be removed' : '👍 Original mono tracks will be kept'}\n`;
    response.infoLog += `🔊 Using enhancement level: ${safeExtrastereoAmount}\n`;
    response.infoLog += `🔊 ${useOriginalBitrate ? 'Using original bitrates where available' : 'Using bitrate: ' + safeAudioBitrate + 'k'}\n`;
  } else {
    response.infoLog += '✅ No mono tracks to convert\n';
  }
  
  return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
