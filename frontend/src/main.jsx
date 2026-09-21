import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./i18n";
import "./styles.css";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { CapabilitiesProvider } from "./contexts/CapabilitiesContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { CategoryLabelsProvider } from "./contexts/CategoryLabelsContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <CapabilitiesProvider>
          <CategoryLabelsProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </CategoryLabelsProvider>
        </CapabilitiesProvider>
      </AuthProvider>
    </LanguageProvider>
  </React.StrictMode>
);
