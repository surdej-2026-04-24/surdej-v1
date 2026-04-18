/**
 * Surdej Extension — Welcome Page
 *
 * Shown automatically when the extension is installed or updated.
 * Pure welcome experience — no configuration.
 * Provides:
 * 1. Post-installation greeting
 * 2. Getting started steps
 * 3. "Open Side Panel" CTA button
 * 4. Optional link to the Options page
 */

import { useState, useEffect, useCallback } from 'react';

type Language = 'en' | 'da';

const i18n = {
    en: {
        heroTitle: 'Welcome to Surdej!',
        installedBadge: '✓ Successfully Installed',
        updatedBadge: '✓ Updated to v{version}',
        heroDesc: 'Your AI-powered assistant is ready. Here\'s how to get the most out of the extension.',
        // Getting Started
        gettingStarted: '🚀 Getting Started',
        step1Title: 'Pin the Extension',
        step1Desc: 'Click the puzzle piece icon in your toolbar, then click the pin icon next to Surdej to keep it visible.',
        step2Title: 'Open the Side Panel',
        step2Desc: 'Click the Surdej icon in your toolbar to open the AI side panel on any website.',
        step3Title: 'Sign In',
        step3Desc: 'Sign in with your Microsoft account to connect to your Surdej workspace.',
        // Language
        langTitle: '🌐 Language / Sprog',
        // CTA
        openSidePanel: '✨ Open Surdej Side Panel',
        ctaTip: 'ℹ️ You can always open the side panel by clicking the Surdej icon in your toolbar.',
        // Options link
        openSettings: '⚙️ Customize Settings',
        // Footer
        footer: 'Surdej Extension v{version} · Built with ❤️ by Happy Mates',
    },
    da: {
        heroTitle: 'Velkommen til Surdej!',
        installedBadge: '✓ Installeret succesfuldt',
        updatedBadge: '✓ Opdateret til v{version}',
        heroDesc: 'Din AI-drevne assistent er klar. Her er hvordan du får mest ud af udvidelsen.',
        // Getting Started
        gettingStarted: '🚀 Kom i gang',
        step1Title: 'Fastgør udvidelsen',
        step1Desc: 'Klik på puslespilsikonet i din værktøjslinje, og klik derefter på nåleikonet ved Surdej for at holde den synlig.',
        step2Title: 'Åbn sidepanelet',
        step2Desc: 'Klik på Surdej ikonet i din værktøjslinje for at åbne AI-sidepanelet på enhver hjemmeside.',
        step3Title: 'Log ind',
        step3Desc: 'Log ind med din Microsoft-konto for at forbinde til dit Surdej arbejdsområde.',
        // Language
        langTitle: '🌐 Language / Sprog',
        // CTA
        openSidePanel: '✨ Åbn Surdej Sidepanelet',
        ctaTip: 'ℹ️ Du kan altid åbne sidepanelet ved at klikke på Surdej ikonet i din værktøjslinje.',
        // Options link
        openSettings: '⚙️ Tilpas indstillinger',
        // Footer
        footer: 'Surdej Extension v{version} · Bygget med ❤️ af Happy Mates',
    },
};

export default function App() {
    const [language, setLanguage] = useState<Language>('da');
    const [installReason, setInstallReason] = useState<'install' | 'update'>('install');
    const version = chrome.runtime.getManifest().version;

    useEffect(() => {
        // Load saved language preference
        chrome.storage.sync.get(['language', '_installReason'], (result) => {
            if (result.language) setLanguage(result.language as Language);
            if (result._installReason) setInstallReason(result._installReason as 'install' | 'update');
        });
    }, []);

    const t = i18n[language];

    const selectLanguage = useCallback((lang: Language) => {
        setLanguage(lang);
        chrome.storage.sync.set({ language: lang });
    }, []);

    const openSidePanel = useCallback(async () => {
        try {
            // Try to open the side panel on the current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
                await (chrome.sidePanel as any).open({ tabId: tab.id });
            }
        } catch {
            // Fallback — tell user to click the icon
            alert(language === 'da'
                ? 'Klik på Surdej ikonet i din browsers værktøjslinje for at åbne sidepanelet.'
                : 'Click the Surdej icon in your browser toolbar to open the side panel.'
            );
        }
    }, [language]);

    const openOptionsPage = useCallback(() => {
        chrome.runtime.openOptionsPage();
    }, []);

    const badge = installReason === 'update'
        ? t.updatedBadge.replace('{version}', version)
        : t.installedBadge;

    return (
        <div className="container">
            {/* Hero */}
            <div className="hero">
                <img src="/icon-128.png" alt="Surdej" style={{ width: 64, height: 64, display: 'block', margin: '0 auto 12px' }} />
                <div className="badge">{badge}</div>
                <h1>{t.heroTitle}</h1>
                <p>{t.heroDesc}</p>
            </div>

            {/* Getting Started */}
            <div className="card">
                <div className="card-title">
                    <span className="emoji">{t.gettingStarted.slice(0, 2)}</span>
                    {t.gettingStarted.slice(3)}
                </div>
                <div className="steps">
                    <div className="step">
                        <div className="step-number">1</div>
                        <div className="step-content">
                            <h3>{t.step1Title}</h3>
                            <p>{t.step1Desc}</p>
                        </div>
                    </div>
                    <div className="step">
                        <div className="step-number">2</div>
                        <div className="step-content">
                            <h3>{t.step2Title}</h3>
                            <p>{t.step2Desc}</p>
                        </div>
                    </div>
                    <div className="step">
                        <div className="step-number">3</div>
                        <div className="step-content">
                            <h3>{t.step3Title}</h3>
                            <p>{t.step3Desc}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Language */}
            <div className="card">
                <div className="card-title">
                    <span className="emoji">🌐</span>
                    Language / Sprog
                </div>
                <div className="lang-picker">
                    <button
                        className={`lang-btn ${language === 'da' ? 'active' : ''}`}
                        onClick={() => selectLanguage('da')}
                    >
                        🇩🇰 Dansk
                    </button>
                    <button
                        className={`lang-btn ${language === 'en' ? 'active' : ''}`}
                        onClick={() => selectLanguage('en')}
                    >
                        🇬🇧 English
                    </button>
                </div>
            </div>

            {/* CTA: Open Side Panel */}
            <div className="card">
                <button className="cta-btn" onClick={openSidePanel}>
                    {t.openSidePanel}
                </button>
                <div className="info-box">
                    <span className="icon">ℹ️</span>
                    <span>{t.ctaTip.slice(3)}</span>
                </div>
            </div>

            {/* Optional: Open Settings */}
            <div className="settings-link-wrapper">
                <button className="settings-link" onClick={openOptionsPage}>
                    {t.openSettings}
                </button>
            </div>

            {/* Footer */}
            <div className="footer">
                {t.footer.replace('{version}', version)}
            </div>
        </div>
    );
}
