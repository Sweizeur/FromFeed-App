import React, { createContext, useContext, useState, useCallback } from 'react';

export type LinkLoadStatus = 'idle' | 'loading' | 'success';

type AddingPlaceContextValue = {
  isAddingPlace: boolean;
  setAddingPlace: (value: boolean) => void;
  linkLoadStatus: LinkLoadStatus;
  setLinkLoadStatus: (status: LinkLoadStatus) => void;
};

const AddingPlaceContext = createContext<AddingPlaceContextValue | null>(null);

export function AddingPlaceProvider({ children }: { children: React.ReactNode }) {
  const [isAddingPlace, setAddingPlace] = useState(false);
  const [linkLoadStatus, setLinkLoadStatus] = useState<LinkLoadStatus>('idle');

  return (
    <AddingPlaceContext.Provider
      value={{
        isAddingPlace,
        setAddingPlace,
        linkLoadStatus,
        setLinkLoadStatus,
      }}
    >
      {children}
    </AddingPlaceContext.Provider>
  );
}

export function useAddingPlace() {
  const ctx = useContext(AddingPlaceContext);
  if (!ctx) {
    throw new Error('useAddingPlace must be used within AddingPlaceProvider');
  }
  return ctx;
}

export function useAddingPlaceOptional() {
  return useContext(AddingPlaceContext);
}
