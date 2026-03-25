import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type LinkLoadStatus = 'idle' | 'loading' | 'success';

type AddingPlaceContextValue = {
  isAddingPlace: boolean;
  setAddingPlace: (value: boolean) => void;
  linkLoadStatus: LinkLoadStatus;
  setLinkLoadStatus: (status: LinkLoadStatus) => void;
  successMessage: string | null;
  setSuccessMessage: (msg: string | null) => void;
  placesVersion: number;
  bumpPlacesVersion: () => void;
};

const AddingPlaceContext = createContext<AddingPlaceContextValue | null>(null);

export function AddingPlaceProvider({ children }: { children: React.ReactNode }) {
  const [isAddingPlace, setAddingPlace] = useState(false);
  const [linkLoadStatus, setLinkLoadStatus] = useState<LinkLoadStatus>('idle');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [placesVersion, setPlacesVersion] = useState(0);
  const bumpPlacesVersion = useCallback(() => setPlacesVersion((value) => value + 1), []);

  const value = useMemo(
    () => ({
      isAddingPlace,
      setAddingPlace,
      linkLoadStatus,
      setLinkLoadStatus,
      successMessage,
      setSuccessMessage,
      placesVersion,
      bumpPlacesVersion,
    }),
    [
      isAddingPlace,
      linkLoadStatus,
      successMessage,
      placesVersion,
      bumpPlacesVersion,
    ],
  );

  return (
    <AddingPlaceContext.Provider value={value}>
      {children}
    </AddingPlaceContext.Provider>
  );
}

export function useAddingPlace() {
  const context = useContext(AddingPlaceContext);
  if (!context) {
    throw new Error('useAddingPlace must be used within AddingPlaceProvider');
  }
  return context;
}

export function useAddingPlaceOptional() {
  return useContext(AddingPlaceContext);
}
