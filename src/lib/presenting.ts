import { createContext, useContext } from 'react';

/** True inside a presentation deck: shared components drop their 「點擊…」 usage hints there. */
export const PresentingContext = createContext(false);
export const usePresenting = () => useContext(PresentingContext);
