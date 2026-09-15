import ReactDOM from 'react-dom/client';

import { App } from '@/app/components/App';
import '@/app/utils/setupMonacoEnvironment';
import { hydrateMetadataStore } from '@/metadata-store/storage/metadataStoreStorage';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import 'react-loading-skeleton/dist/skeleton.css';
import 'twenty-ui/style.css';
import 'twenty-ui/theme-light.css';
import 'twenty-ui/theme-dark.css';
// La Vivenzia theme: must follow the two twenty-ui theme files it overrides (CM-005).
import './lv/lv-theme.css';
import './index.css';

const renderApp = () => {
  const root = ReactDOM.createRoot(
    document.getElementById('root') ?? document.body,
  );

  root.render(<App />);
};

hydrateMetadataStore().then(renderApp, renderApp);
