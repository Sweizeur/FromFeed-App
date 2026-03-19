import { create } from 'zustand';

interface FiltersState {
  searchText: string;
  selectedCategory: string | null;
  selectedType: string | null;
  setSearchText: (text: string) => void;
  setCategory: (category: string | null) => void;
  setType: (type: string | null) => void;
  reset: () => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  searchText: '',
  selectedCategory: null,
  selectedType: null,
  setSearchText: (text) => set({ searchText: text }),
  setCategory: (category) => set({ selectedCategory: category, selectedType: null }),
  setType: (type) => set({ selectedType: type }),
  reset: () => set({ searchText: '', selectedCategory: null, selectedType: null }),
}));
