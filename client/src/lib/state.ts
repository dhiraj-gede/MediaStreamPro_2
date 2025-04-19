import { create } from 'zustand';

// Define store types
interface UploadState {
  selectedFiles: File[];
  addFiles: (files: File[]) => void;
  removeFile: (name: string) => void;
  clearFiles: () => void;
}

interface FilterState {
  category: string | null;
  folderId: string | null;
  setCategory: (category: string | null) => void;
  setFolderId: (folderId: string | null) => void;
  resetFilters: () => void;
}

// Upload store
export const useUploadStore = create<UploadState>((set) => ({
  selectedFiles: [],
  addFiles: (files) => set((state) => ({
    selectedFiles: [...state.selectedFiles, ...files]
  })),
  removeFile: (name) => set((state) => ({
    selectedFiles: state.selectedFiles.filter((file) => file.name !== name)
  })),
  clearFiles: () => set({ selectedFiles: [] })
}));

// Filter store
export const useFilterStore = create<FilterState>((set) => ({
  category: null,
  folderId: null,
  setCategory: (category) => set({ category }),
  setFolderId: (folderId) => set({ folderId }),
  resetFilters: () => set({ category: null, folderId: null })
}));
