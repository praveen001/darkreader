import {createOrUpdateStyle, removeStyle} from './style';
import {createOrUpdateSVGFilter, removeSVGFilter} from './svg-filter';
import {createOrUpdateDynamicTheme, removeDynamicTheme, cleanDynamicThemeCache} from './dynamic-theme';
import {logWarn} from './utils/log';

function onMessage({type, data}) {
    switch (type) {
        case 'add-css-filter':
        case 'add-static-theme': {
            const css = data;
            removeDynamicTheme();
            createOrUpdateStyle(css);
            break;
        }
        case 'add-svg-filter': {
            const {css, svgMatrix, svgReverseMatrix} = data;
            removeDynamicTheme();
            createOrUpdateSVGFilter(svgMatrix, svgReverseMatrix);
            createOrUpdateStyle(css);
            break;
        }
        case 'add-dynamic-theme': {
            const {filter, fixes, isIFrame} = data;
            removeStyle();
            createOrUpdateDynamicTheme(filter, fixes, isIFrame);
            break;
        }
        case 'clean-up': {
            removeStyle();
            removeSVGFilter();
            removeDynamicTheme();
            break;
        }
        case 'updates-for-ui': {
            window.postMessage({
                type: 'darkreader-ui-updates',
                data
            }, "*");
        }
    }
}

const port = chrome.runtime.connect({name: 'tab'});
port.postMessage({
  type: 'subscribe-to-updates-for-ui'
});
port.onMessage.addListener(onMessage);
port.onDisconnect.addListener(() => {
    logWarn('disconnect');
    cleanDynamicThemeCache();
});
