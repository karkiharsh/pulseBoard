import React, {createContext, useContext } from "react"; 
import {AppSettings} from "../types"; 

type DashboardContextType = { 
  renderCount : number; 
  settings:AppSettings; 
  toggleSetting:(Key: keyof AppSettings) =>void; 
  systemInfo :any; 
  isLoading : boolean;
};

export const DashboardContext = createContext <DashboardContextType | null > (null); 

export const useDashboard = () => { 
  const ctx = useContext(DashboardContext);
  if(!ctx) throw new Error("useDashboard must be used within a DashboardProvider");
  return ctx; 
  
}