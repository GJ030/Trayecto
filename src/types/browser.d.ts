/** APIs del navegador que aún no están en lib.dom (File System Access API) y la biblioteca de mapas cargada desde la CDN. */
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}
interface FileSystemHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}
interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: string | FileSystemHandle;
}
declare const maplibregl: typeof import('maplibre-gl');
interface Window {
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
  maplibregl?: typeof import('maplibre-gl');
  __trayecto?: unknown;
}
