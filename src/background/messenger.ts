import {ExtensionData, FilterConfig, TabInfo, Message, UserSettings} from '../definitions';
import { getURLHost } from 'utils/url';

interface ExtensionAdapter {
    collect: () => Promise<ExtensionData>;
    getActiveTabInfo: () => Promise<TabInfo>;
    changeSettings: (settings: Partial<UserSettings>) => void;
    setTheme: (theme: Partial<FilterConfig>) => void;
    setShortcut: ({command, shortcut}) => void;
    markNewsAsRead: (ids: string[]) => void;
    toggleSitePattern: (pattern: string) => void;
    onPopupOpen: () => void;
    applyDevDynamicThemeFixes: (json: string) => Error;
    resetDevDynamicThemeFixes: () => void;
    applyDevInversionFixes: (json: string) => Error;
    resetDevInversionFixes: () => void;
    applyDevStaticThemes: (text: string) => Error;
    resetDevStaticThemes: () => void;
    getStatus: (url: string) => any;
}

export default class Messenger {
    private reporters: Set<(info: ExtensionData) => void>;
    private ports: Set<chrome.runtime.Port>;
    private adapter: ExtensionAdapter;

    constructor(adapter: ExtensionAdapter) {
        this.reporters = new Set();
        this.ports = new Set();
        this.adapter = adapter;
        chrome.runtime.onConnect.addListener((port) => {
            if (port.name === 'ui') {
                port.onMessage.addListener((message) => this.onUIMessage(port, message));
                this.adapter.onPopupOpen();
            }

            if (port.name === 'tab') {
                port.onMessage.addListener((message => this.onTabMessage(port, message)));
            }
        });
    }

    private async onTabMessage(port: chrome.runtime.Port, { type, id, data}: Message) {
        switch (type) {
            case 'subscribe-to-updates-for-ui': {
                this.ports.add(port);
                port.onDisconnect.addListener(() => {
                    this.ports.delete(port);
                });
                break;
            }

            case 'is-darkreader-installed': {
                port.postMessage({
                    type: 'darkreader-ui-updates',
                    data: this.adapter.getStatus(port.sender.url)
                });
                break;
            }

            case 'darkreader-toggle-site': {
                this.adapter.toggleSitePattern(getURLHost(port.sender.url || ''));
                break;
            }
        }
    }

    private async onUIMessage(port: chrome.runtime.Port, {type, id, data}: Message) {
        switch (type) {
            case 'get-data': {
                const data = await this.adapter.collect();
                port.postMessage({id, data});
                break;
            }
            case 'get-active-tab-info': {
                const data = await this.adapter.getActiveTabInfo();
                port.postMessage({id, data});
                break;
            }
            case 'subscribe-to-changes': {
                const report = (data) => port.postMessage({id, data});
                this.reporters.add(report);
                port.onDisconnect.addListener(() => this.reporters.delete(report));
                break;
            }
            case 'change-settings': {
                this.adapter.changeSettings(data);
                break;
            }
            case 'set-theme': {
                this.adapter.setTheme(data);
                break;
            }
            case 'set-shortcut': {
                this.adapter.setShortcut(data);
                break;
            }
            case 'toggle-site-pattern': {
                this.adapter.toggleSitePattern(data);
                break;
            }
            case 'mark-news-as-read': {
                this.adapter.markNewsAsRead(data);
                break;
            }

            case 'apply-dev-dynamic-theme-fixes': {
                const error = this.adapter.applyDevDynamicThemeFixes(data);
                port.postMessage({id, error: (error ? error.message : null)});
                break;
            }
            case 'reset-dev-dynamic-theme-fixes': {
                this.adapter.resetDevDynamicThemeFixes();
                break;
            }
            case 'apply-dev-inversion-fixes': {
                const error = this.adapter.applyDevInversionFixes(data);
                port.postMessage({id, error: (error ? error.message : null)});
                break;
            }
            case 'reset-dev-inversion-fixes': {
                this.adapter.resetDevInversionFixes();
                break;
            }
            case 'apply-dev-static-themes': {
                const error = this.adapter.applyDevStaticThemes(data);
                port.postMessage({id, error: error ? error.message : null});
                break;
            }
            case 'reset-dev-static-themes': {
                this.adapter.resetDevStaticThemes();
                break;
            }
        }
    }

    reportChanges(data: ExtensionData) {
        this.reporters.forEach((report) => report(data));
    }

    reportChangesToContentScript() {
        this.ports.forEach(port => port.postMessage({
            type: 'darkreader-ui-updates',
            data: this.adapter.getStatus(port.sender.url)
        }));
    }

    getPorts() {
        return this.ports;
    }
}
