import { LicenseInfo } from "@mui/x-license-pro";

// If the license is missing/expired, the grid will show a watermark.
// This is still the correct production pattern (env var + initialization).
LicenseInfo.setLicenseKey(import.meta.env.VITE_MUI_LICENSE_KEY || "");

import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
