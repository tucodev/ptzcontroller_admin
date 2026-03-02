import fs from 'fs';
import path from 'path';
import { CameraConfig, PresetConfig, AppSettings } from './types';

const DATA_DIR      = path.join(process.cwd(), 'data');
const CAMERAS_FILE  = path.join(DATA_DIR, 'cameras.json');
const PRESETS_FILE  = path.join(DATA_DIR, 'presets.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULT_SETTINGS: AppSettings = {
  defaultProtocol:    'pelcod',
  defaultOperationMode: 'direct',
  proxyPort:          9902,
  logLevel:           'info',
  theme:              'dark',
};

// data 디렉토리 없으면 자동 생성
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ─── 공통 JSON 파일 읽기/쓰기 헬퍼 ──────────────────────────

function readJsonFile<T>(filePath: string, defaultValue: T): T {
  ensureDataDir();
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return defaultValue;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Camera Configuration ─────────────────────────────────

export function getCameras(): CameraConfig[] {
  return readJsonFile<CameraConfig[]>(CAMERAS_FILE, []);
}

export function getCamera(id: string): CameraConfig | undefined {
  return getCameras().find(c => c.id === id);
}

export function saveCamera(camera: CameraConfig): CameraConfig {
  const cameras = getCameras();
  const index   = cameras.findIndex(c => c.id === camera.id);
  const now     = new Date().toISOString();

  if (index >= 0) {
    cameras[index] = { ...camera, updatedAt: now };
  } else {
    cameras.push({ ...camera, createdAt: now, updatedAt: now });
  }

  writeJsonFile(CAMERAS_FILE, cameras);
  return camera;
}

export function deleteCamera(id: string): boolean {
  const cameras  = getCameras();
  const filtered = cameras.filter(c => c.id !== id);
  writeJsonFile(CAMERAS_FILE, filtered);
  return filtered.length !== cameras.length;
}

// ─── Presets Configuration ────────────────────────────────

export function getPresets(cameraId?: string): PresetConfig[] {
  const presets = readJsonFile<PresetConfig[]>(PRESETS_FILE, []);
  return cameraId ? presets.filter(p => p.cameraId === cameraId) : presets;
}

export function savePreset(preset: PresetConfig): PresetConfig {
  const presets = getPresets();
  const index   = presets.findIndex(p => p.id === preset.id);

  if (index >= 0) {
    presets[index] = preset;
  } else {
    presets.push(preset);
  }

  writeJsonFile(PRESETS_FILE, presets);
  return preset;
}

export function deletePreset(id: string): boolean {
  const presets  = getPresets();
  const filtered = presets.filter(p => p.id !== id);
  writeJsonFile(PRESETS_FILE, filtered);
  return filtered.length !== presets.length;
}

// ─── App Settings ─────────────────────────────────────────

export function getSettings(): AppSettings {
  return readJsonFile<AppSettings>(SETTINGS_FILE, DEFAULT_SETTINGS);
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const updated = { ...getSettings(), ...settings };
  writeJsonFile(SETTINGS_FILE, updated);
  return updated;
}
