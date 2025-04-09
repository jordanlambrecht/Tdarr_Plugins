/* eslint max-len: 0 */
const _ = require('lodash');
const run = require('../helpers/run');

const tests = [
  // Test 1: Basic functionality - Quality mode
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
        codecs: '',
        extrastereo_amount: '1.7',
        audio_bitrate: 'Keep Original',
        remove_original: 'true',
        languages: '',
        upmix_mode: 'Quality'
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('pan=stereo|c0=c0|c1=c0,extrastereo=m=1.7'),
      container: '.mp4',
      handBrakeMode: false,
      FFmpegMode: true,
      reQueueAfter: false,
      infoLog: expect.stringContaining('Will convert'),
    },
  },
  
  // Test 2: Speed mode operation - uses simpler filter
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
        codecs: '',
        extrastereo_amount: '1.7',
        audio_bitrate: 'Keep Original',
        remove_original: 'true',
        languages: '',
        upmix_mode: 'Speed'
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('pan=stereo|c0=c0|c1=c0'),
      preset: expect.not.stringContaining('extrastereo'),
      infoLog: expect.stringContaining('speed-optimized'),
    },
  },
  
  // Test 3: Keep original mono tracks alongside stereo versions
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
        codecs: '',
        extrastereo_amount: '1.7',
        audio_bitrate: 'Keep Original',
        remove_original: 'false',
        languages: '',
        upmix_mode: 'Quality'
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.not.stringContaining('-map -0:'),
      infoLog: expect.stringContaining('Original mono tracks will be kept'),
    },
  },
  
  // Test 4: Codec filtering - only convert specific codecs
  {
    input: {
      file: (() => {
        const file = _.cloneDeep(require('../sampleData/media/sampleH264_2.json'));
        // Set up multiple mono audio streams with different codecs
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
        audio_bitrate: 'Keep Original',
        remove_original: 'true',
        languages: '',
        upmix_mode: 'Quality'
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('stereo0'),
      preset: expect.not.stringContaining('stereo1'),
      infoLog: expect.stringContaining('Skipping: mono track'),
    },
  },
  
  // Test 5: Language filtering - only convert specific languages
  {
    input: {
      file: (() => {
        const file = _.cloneDeep(require('../sampleData/media/sampleH264_2.json'));
        // Set up multiple mono audio streams with different languages
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
        codecs: '',
        extrastereo_amount: '1.7',
        audio_bitrate: 'Keep Original',
        remove_original: 'true',
        languages: 'eng',
        upmix_mode: 'Quality'
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('language=eng'),
      preset: expect.not.stringContaining('language=jpn'),
      infoLog: expect.stringContaining('Skipping: mono track'),
    },
  },
  
  // Test 6: Custom bitrate setting
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
        codecs: '',
        extrastereo_amount: '1.7',
        audio_bitrate: '320',
        remove_original: 'true',
        languages: '',
        upmix_mode: 'Quality'
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('320k'),
      infoLog: expect.stringContaining('Using bitrate: 320k'),
    },
  },
  
  // Test 7: No mono tracks to convert
  {
    input: {
      file: _.cloneDeep(require('../sampleData/media/sampleH264_1.json')),
      librarySettings: {},
      inputs: {
        codecs: '',
        extrastereo_amount: '1.7',
        audio_bitrate: 'Keep Original',
        remove_original: 'true',
        languages: '',
        upmix_mode: 'Quality'
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
          file.ffProbeData.streams[1].disposition = { default: 1 };
        }
        return file;
      })(),
      librarySettings: {},
      inputs: {
        codecs: '',
        extrastereo_amount: '1.7',
        audio_bitrate: 'Keep Original',
        remove_original: 'true',
        languages: '',
        upmix_mode: 'Quality'
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('language=eng'),
      preset: expect.stringContaining('title="Commentary (Stereo)"'),
      preset: expect.stringContaining('disposition:a:'),
    },
  },
  
  // Test 9: Multiple mono tracks with different codecs (processing all)
  {
    input: {
      file: (() => {
        const file = _.cloneDeep(require('../sampleData/media/sampleH264_2.json'));
        // Set up multiple mono audio streams with different codecs
        file.ffProbeData.streams[1].channels = 1;
        file.ffProbeData.streams[1].codec_name = 'aac';
        file.ffProbeData.streams[2].channels = 1;
        file.ffProbeData.streams[2].codec_name = 'ac3';
        return file;
      })(),
      librarySettings: {},
      inputs: {
        codecs: '',
        extrastereo_amount: '1.7',
        audio_bitrate: 'Keep Original',
        remove_original: 'true',
        languages: '',
        upmix_mode: 'Quality'
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('stereo0'),
      preset: expect.stringContaining('stereo1'),
      infoLog: expect.stringContaining('Will convert 2 mono track'),
    },
  },
  
  // Test 10: Filter complex string has proper quotes
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
        codecs: '',
        extrastereo_amount: '1.7',
        audio_bitrate: 'Keep Original',
        remove_original: 'true',
        languages: '',
        upmix_mode: 'Quality'
      },
      otherArguments: {},
    },
    output: {
      processFile: true,
      preset: expect.stringContaining('-filter_complex "'),
      infoLog: expect.stringContaining('Will convert'),
    },
  }
];

void run(tests);
