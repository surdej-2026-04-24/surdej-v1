import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from '@/core/auth/AuthContext';
import { FeatureProvider } from '@/core/features/FeatureContext';
import { AccessibilityProvider } from '@/core/accessibility/AccessibilityContext';
import { I18nProvider } from '@/core/i18n';
import { SkinProvider } from '@/core/skins/SkinContext';
import { TenantProvider } from '@/core/tenants/TenantContext';
import { WireframeProvider } from '@/core/wireframe';
import { FeedbackProvider } from '@/core/feedback/FeedbackContext';
import { App } from '@/App';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <AccessibilityProvider>
                <I18nProvider>
                    <AuthProvider>
                        <FeatureProvider>
                            <TenantProvider>
                                <SkinProvider>
                                    <WireframeProvider>
                                        <FeedbackProvider>
                                            <App />
                                        </FeedbackProvider>
                                    </WireframeProvider>
                                </SkinProvider>
                            </TenantProvider>
                        </FeatureProvider>
                    </AuthProvider>
                </I18nProvider>
            </AccessibilityProvider>
        </BrowserRouter>
    </StrictMode>,
);
