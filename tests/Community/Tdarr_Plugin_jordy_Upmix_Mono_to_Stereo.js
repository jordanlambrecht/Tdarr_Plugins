/* eslint max-len: 0 */
const _ = require('lodash');
const run = require('../helpers/run');

const tests = [
  // Test 1: Basic functionality - convert mono to stereo with default settings
  {
    input: {
      file: (() => {
        const file = _.cloneDeep(require('../sampleData/media/sampleH264_1.json'));
        // Modify a stream to be mono
        if (file.ffProbeData.streams[1].codec_type === 'audio') {
          file.ffProbeData.streams[1].channels = 1;
          file.ffProbeData.streams[1].codec_name = 'aac';
        }
        return file;
      })(),
      librarySettings: {},
      inputs: {
        codecs: 'all',
        extrastereo_amount: '1.7',
        audio_bitrate: '192',
        remove_original: 'true',
        languages: ''
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('-filter_complex'),
      container: '.mp4',
      handBrakeMode: false,
      FFmpegMode: true,
      reQueueAfter: false,
      infoLog: expect.stringContaining('Will convert'),
    },
  },
  
  // Test 2: Keep original mono tracks alongside stereo versions
  {
    input: {
      file: (() => {
        const file = _.cloneDeep(require('../sampleData/media/sampleH264_1.json'));
        // Modify a stream to be mono
        if (file.ffProbeData.streams[1].codec_type === 'audio') {
          file.ffProbeData.streams[1].channels = 1;
          file.ffProbeData.streams[1].codec_name = 'aac';
        }
        return file;
      })(),
      librarySettings: {},
      inputs: {
        codecs: 'all',
        extrastereo_amount: '1.7',
        audio_bitrate: '192',
        remove_original: 'false',
        languages: ''
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('-map 0'),
      preset: expect.not.stringContaining('-map -0:'), // Should not remove any streams
      container: '.mp4',
      handBrakeMode: false,
      FFmpegMode: true,
      reQueueAfter: false,
      infoLog: expect.stringContaining('Original mono tracks will be kept'),
    },
  },
  
  // Test 3: Codec filtering - only convert specific codecs
  {
    input: {
      file: (() => {
        const file = _.cloneDeep(require('../sampleData/media/sampleH264_2.json'));
        // Set up multiple audio streams with different codecs
        file.ffProbeData.streams[1].channels = 1;
        file.ffProbeData.streams[1].codec_name = 'aac';
        file.ffProbeData.streams[2].channels = 1;
        file.ffProbeData.streams[2].codec_name = 'ac3';
        return file;
      })(),
      librarySettings: {},
      inputs: {
        codecs: 'aac',
        extrastereo_amount: '1.7',
        audio_bitrate: '192',
        remove_original: 'true',
        languages: ''
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('aformat'),
      infoLog: expect.stringContaining('Will convert'),
      infoLog: expect.stringContaining('Skipping'),
    },
  },
  
  // Test 4: Language filtering - only convert specific languages
  {
    input: {
      file: (() => {
        const file = _.cloneDeep(require('../sampleData/media/sampleH264_2.json'));
        // Set up multiple audio streams with different languages
        file.ffProbeData.streams[1].channels = 1;
        file.ffProbeData.streams[1].codec_name = 'aac';
        if (!file.ffProbeData.streams[1].tags) file.ffProbeData.streams[1].tags = {};
        file.ffProbeData.streams[1].tags.language = 'eng';
        
        file.ffProbeData.streams[2].channels = 1;
        file.ffProbeData.streams[2].codec_name = 'aac';
        if (!file.ffProbeData.streams[2].tags) file.ffProbeData.streams[2].tags = {};
        file.ffProbeData.streams[2].tags.language = 'jpn';
        return file;
      })(),
      librarySettings: {},
      inputs: {
        codecs: 'all',
        extrastereo_amount: '1.7',
        audio_bitrate: '192',
        remove_original: 'true',
        languages: 'eng'
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      infoLog: expect.stringContaining('eng'),
      infoLog: expect.not.stringContaining('Will convert: audio track'),
      infoLog: expect.stringContaining('Skipping'),
    },
  },
  
  // Test 5: Custom enhancement and bitrate settings
  {
    input: {
      file: (() => {
        const file = _.cloneDeep(require('../sampleData/media/sampleH264_1.json'));
        // Modify a stream to be mono
        if (file.ffProbeData.streams[1].codec_type === 'audio') {
          file.ffProbeData.streams[1].channels = 1;
          file.ffProbeData.streams[1].codec_name = 'aac';
        }
        return file;
      })(),
      librarySettings: {},
      inputs: {
        codecs: 'all',
        extrastereo_amount: '2.2',
        audio_bitrate: '320',
        remove_original: 'true',
        languages: ''
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('extrastereo=m=2.2'),
      preset: expect.stringContaining('320k'),
      container: '.mp4',
      handBrakeMode: false,
      FFmpegMode: true,
      infoLog: expect.stringContaining('320k'),
    },
  },
  
  // Test 6: Keep Original bitrate setting
  {
    input: {
      file: (() => {
        const file = _.cloneDeep(require('../sampleData/media/sampleH264_1.json'));
        // Modify a stream to be mono with bitrate
        if (file.ffProbeData.streams[1].codec_type === 'audio') {
          file.ffProbeData.streams[1].channels = 1;
          file.ffProbeData.streams[1].codec_name = 'aac';
          file.ffProbeData.streams[1].bit_rate = '128000';
        }
        return file;
      })(),
      librarySettings: {},
      inputs: {
        codecs: 'all',
        extrastereo_amount: '1.7',
        audio_bitrate: 'Keep Original',
        remove_original: 'true',
        languages: ''
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('128k'),
      infoLog: expect.stringContaining('Using original bitrates'),
    },
  },
  
  // Test 7: No mono tracks to convert
  {
    input: {
      file: _.cloneDeep(require('../sampleData/media/sampleH264_1.json')),
      librarySettings: {},
      inputs: {
        codecs: 'all',
        extrastereo_amount: '1.7',
        audio_bitrate: '192',
        remove_original: 'true',
        languages: ''
      },
      otherArguments: {},
    },
    output: {
      processFile: false,
      infoLog: expect.stringContaining('No mono tracks to convert'),
    },
  },
  
  // Test 8: Metadata preservation
  {
    input: {
      file: (() => {
        const file = _.cloneDeep(require('../sampleData/media/sampleH264_1.json'));
        // Modify a stream to be mono with metadata
        if (file.ffProbeData.streams[1].codec_type === 'audio') {
          file.ffProbeData.streams[1].channels = 1;
          file.ffProbeData.streams[1].codec_name = 'aac';
          if (!file.ffProbeData.streams[1].tags) file.ffProbeData.streams[1].tags = {};
          file.ffProbeData.streams[1].tags.language = 'eng';
          file.ffProbeData.streams[1].tags.title = 'Commentary';
        }
        return file;
      })(),
      librarySettings: {},
      inputs: {
        codecs: 'all',
        extrastereo_amount: '1.7',
        audio_bitrate: '192',
        remove_original: 'true',
        languages: ''
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('language=eng'),
      preset: expect.stringContaining('title="Commentary'),
    },
  },
];

void run(tests);
