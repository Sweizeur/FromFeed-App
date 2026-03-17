import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type SearchContextValue = {
  searchText: string;
  setSearchText: (text: string) => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function useSearchText(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearchText must be used inside SearchContextProvider');
  return ctx;
}

type SearchContextProviderProps = {
  children: ReactNode;
};

export function SearchContextProvider({ children }: SearchContextProviderProps) {
  const [searchText, setSearchText] = useState('');
  const value: SearchContextValue = {
    searchText,
    setSearchText: useCallback((text: string) => setSearchText(text), []),
  };
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}
