"use client";

import { createContext, useContext, useState } from "react";

interface PageTitleContextValue {
  title: string;
  isLargeTitleVisible: boolean;
  setTitle: (title: string) => void;
  setIsLargeTitleVisible: (visible: boolean) => void;
}

const PageTitleContext = createContext<PageTitleContextValue>({
  title: "",
  isLargeTitleVisible: true,
  setTitle: () => {},
  setIsLargeTitleVisible: () => {},
});

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState("");
  const [isLargeTitleVisible, setIsLargeTitleVisible] = useState(true);

  return (
    <PageTitleContext.Provider
      value={{ title, isLargeTitleVisible, setTitle, setIsLargeTitleVisible }}
    >
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle() {
  return useContext(PageTitleContext);
}
