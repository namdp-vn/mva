const fs = require('fs');
const path = require('path');
const os = require('os');
const {execFileSync} = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const modelSrcRoot = path.join(projectRoot, 'assets', 'models');
const modelDstRoot = process.argv[2];
const androidModelRoot = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'models');
const MODEL_ARCHIVE_URLS = {
  'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17':
    'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2',
  'sherpa-onnx-whisper-small-int8':
    'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small-int8.tar.bz2',
};

if (!modelDstRoot) {
  throw new Error('Missing destination models directory argument');
}

const requiredModels = [
  {
    folder: 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17',
    files: ['model.int8.onnx', 'tokens.txt'],
  },
  {
    folder: 'sherpa-onnx-whisper-small-int8',
    files: ['small-encoder.int8.onnx', 'small-decoder.int8.onnx', 'small-tokens.txt'],
  },
  {
    folder: 'speaker-diarization',
    files: ['model.onnx', '3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx'],
  },
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, {recursive: true});
}

function ensureFileFromAndroid(model, file) {
  const srcFile = path.join(androidModelRoot, model.folder, file);
  const dstFile = path.join(modelSrcRoot, model.folder, file);

  if (!fs.existsSync(srcFile)) {
    return false;
  }

  ensureDir(path.dirname(dstFile));
  fs.copyFileSync(srcFile, dstFile);
  return true;
}

function ensureModelArchiveFiles(model) {
  const missingFiles = model.files.filter((file) => !fs.existsSync(path.join(modelSrcRoot, model.folder, file)));

  if (missingFiles.length === 0) {
    return;
  }

  const archiveUrl = MODEL_ARCHIVE_URLS[model.folder];
  if (!archiveUrl) {
    throw new Error(`No download URL configured for model: ${model.folder}`);
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `mva-${model.folder}-`));
  const archivePath = path.join(tmpRoot, `${model.folder}.tar.bz2`);

  console.log(`[models] Downloading ${model.folder} for iOS bundle assets...`);
  execFileSync('curl', ['-L', '--fail', '--silent', '--show-error', '-o', archivePath, archiveUrl], {
    stdio: 'inherit',
  });

  execFileSync('tar', ['-xjf', archivePath, '-C', tmpRoot, ...missingFiles.map((file) => `${model.folder}/${file}`)], {
    stdio: 'inherit',
  });

  for (const file of missingFiles) {
    const extractedFile = path.join(tmpRoot, model.folder, file);
    const dstFile = path.join(modelSrcRoot, model.folder, file);

    if (!fs.existsSync(extractedFile)) {
      throw new Error(`Downloaded archive did not contain required model file: ${model.folder}/${file}`);
    }

    ensureDir(path.dirname(dstFile));
    fs.copyFileSync(extractedFile, dstFile);
  }
}

function ensureRequiredSourceAssets() {
  for (const model of requiredModels) {
    for (const file of model.files) {
      const srcFile = path.join(modelSrcRoot, model.folder, file);

      if (fs.existsSync(srcFile)) {
        continue;
      }

      if (ensureFileFromAndroid(model, file)) {
        continue;
      }

      if (MODEL_ARCHIVE_URLS[model.folder]) {
        ensureModelArchiveFiles(model);
        continue;
      }

      throw new Error(`Missing required bundled model file: ${srcFile}`);
    }
  }
}

ensureRequiredSourceAssets();

for (const model of requiredModels) {
  const srcDir = path.join(modelSrcRoot, model.folder);
  const dstDir = path.join(modelDstRoot, model.folder);

  ensureDir(dstDir);

  for (const file of model.files) {
    const srcFile = path.join(srcDir, file);
    const dstFile = path.join(dstDir, file);

    if (!fs.existsSync(srcFile)) {
      throw new Error(`Missing required bundled model file: ${srcFile}`);
    }

    fs.copyFileSync(srcFile, dstFile);
  }
}
