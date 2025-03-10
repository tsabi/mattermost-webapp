// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable max-lines */

import React from 'react';
import {FormattedMessage} from 'react-intl';

import cssVars from 'css-vars-ponyfill';

import moment from 'moment';

import {
    getChannel as getChannelAction,
    getChannelByNameAndTeamName,
    getChannelMember,
    joinChannel,
} from 'mattermost-redux/actions/channels';
import {getPost as getPostAction} from 'mattermost-redux/actions/posts';
import {getTeamByName as getTeamByNameAction} from 'mattermost-redux/actions/teams';
import {Client4} from 'mattermost-redux/client';
import {Posts, Preferences} from 'mattermost-redux/constants';
import {
    getChannel,
    getChannelsNameMapInTeam,
    getMyChannelMemberships,
    getRedirectChannelNameForTeam,
} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getBool, getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {blendColors, changeOpacity} from 'mattermost-redux/utils/theme_utils';
import {displayUsername, isSystemAdmin} from 'mattermost-redux/utils/user_utils';
import {
    getCurrentRelativeTeamUrl,
    getCurrentTeam,
    getCurrentTeamId,
    getTeam,
    getTeamByName,
    getTeamMemberships,
} from 'mattermost-redux/selectors/entities/teams';

import {addUserToTeam} from 'actions/team_actions';
import {searchForTerm} from 'actions/post_actions';
import {browserHistory} from 'utils/browser_history';
import Constants, {FileTypes, UserStatuses, ValidationErrors} from 'utils/constants.jsx';
import * as UserAgent from 'utils/user_agent';
import bing from 'sounds/bing.mp3';
import crackle from 'sounds/crackle.mp3';
import down from 'sounds/down.mp3';
import hello from 'sounds/hello.mp3';
import ripple from 'sounds/ripple.mp3';
import upstairs from 'sounds/upstairs.mp3';
import {t} from 'utils/i18n';
import store from 'stores/redux_store.jsx';

import {getCurrentLocale, getTranslations} from 'selectors/i18n';
import {getIsMobileView} from 'selectors/views/browser';

import PurchaseLink from 'components/announcement_bar/purchase_link/purchase_link';
import ContactUsButton from 'components/announcement_bar/contact_sales/contact_us';

import {joinPrivateChannelPrompt} from './channel_utils';

const CLICKABLE_ELEMENTS = [
    'a',
    'button',
    'img',
    'svg',
    'audio',
    'video',
];

export function isMac() {
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

export function isLinux() {
    return navigator.platform.toUpperCase().indexOf('LINUX') >= 0;
}

export function createSafeId(prop) {
    if (prop === null) {
        return undefined;
    }

    var str = '';

    if (prop.props && prop.props.defaultMessage) {
        str = prop.props.defaultMessage;
    } else {
        str = prop.toString();
    }

    return str.replace(new RegExp(' ', 'g'), '_');
}

export function cmdOrCtrlPressed(e, allowAlt = false) {
    if (allowAlt) {
        return (isMac() && e.metaKey) || (!isMac() && e.ctrlKey);
    }
    return (isMac() && e.metaKey) || (!isMac() && e.ctrlKey && !e.altKey);
}

export function isKeyPressed(event, key) {
    // There are two types of keyboards
    // 1. English with different layouts(Ex: Dvorak)
    // 2. Different language keyboards(Ex: Russian)

    if (event.keyCode === Constants.KeyCodes.COMPOSING[1]) {
        return false;
    }

    // checks for event.key for older browsers and also for the case of different English layout keyboards.
    if (typeof event.key !== 'undefined' && event.key !== 'Unidentified' && event.key !== 'Dead') {
        const isPressedByCode = event.key === key[0] || event.key === key[0].toUpperCase();
        if (isPressedByCode) {
            return true;
        }
    }

    // used for different language keyboards to detect the position of keys
    return event.keyCode === key[1];
}

/**
 * check keydown event for line break combo. Should catch alt/option + enter not all browsers except Safari
 * @param  {object}  e - keydown event
 * @return {boolean}
 */
export function isUnhandledLineBreakKeyCombo(e) {
    return Boolean(
        isKeyPressed(e, Constants.KeyCodes.ENTER) &&
        !e.shiftKey && // shift + enter is already handled everywhere, so don't handle again
        (e.altKey && !UserAgent.isSafari() && !cmdOrCtrlPressed(e)), // alt/option + enter is already handled in Safari, so don't handle again
    );
}

/**
 * insert a new line character at keyboard cursor (or overwrites selection)
 * @param  {object}  e - keydown event
 * @return {string} message modified with new line inserted for app consumption
 * WARNING: HAS DOM SIDE EFFECTS
 */
export function insertLineBreakFromKeyEvent(e) {
    const el = e.target;
    const {selectionEnd, selectionStart, value} = el;

    // replace text selection (or insert if no selection) with new line character
    const newValue = `${value.substr(0, selectionStart)}\n${value.substr(selectionEnd, value.length)}`;

    // update value on DOM element immediately and restore key cursor to correct position
    el.value = newValue;
    setSelectionRange(el, selectionStart + 1, selectionStart + 1);

    // return the updated string so that component state can be updated
    return newValue;
}

export function isInRole(roles, inRole) {
    if (roles) {
        var parts = roles.split(' ');
        for (var i = 0; i < parts.length; i++) {
            if (parts[i] === inRole) {
                return true;
            }
        }
    }

    return false;
}

export function getTeamRelativeUrl(team) {
    if (!team) {
        return '';
    }

    return '/' + team.name;
}

export function getPermalinkURL(state, teamId, postId) {
    let team = getTeam(state, teamId);
    if (!team) {
        team = getCurrentTeam(state);
    }
    return `${getTeamRelativeUrl(team)}/pl/${postId}`;
}

export function getChannelURL(state, channel, teamId) {
    let notificationURL;
    if (channel && (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL)) {
        notificationURL = getCurrentRelativeTeamUrl(state) + '/channels/' + channel.name;
    } else if (channel) {
        const team = getTeam(state, teamId);
        notificationURL = getTeamRelativeUrl(team) + '/channels/' + channel.name;
    } else if (teamId) {
        const team = getTeam(state, teamId);
        const redirectChannel = getRedirectChannelNameForTeam(state, teamId);
        notificationURL = getTeamRelativeUrl(team) + `/channels/${redirectChannel}`;
    } else {
        const currentTeamId = getCurrentTeamId(state);
        const redirectChannel = getRedirectChannelNameForTeam(state, currentTeamId);
        notificationURL = getCurrentRelativeTeamUrl(state) + `/channels/${redirectChannel}`;
    }
    return notificationURL;
}

export const notificationSounds = new Map([
    ['Bing', bing],
    ['Crackle', crackle],
    ['Down', down],
    ['Hello', hello],
    ['Ripple', ripple],
    ['Upstairs', upstairs],
]);

var canDing = true;
export function ding(name) {
    if (hasSoundOptions() && canDing) {
        tryNotificationSound(name);
        canDing = false;
        setTimeout(() => {
            canDing = true;
        }, 3000);
    }
}

export function tryNotificationSound(name) {
    const audio = new Audio(notificationSounds.get(name) ?? notificationSounds.get('Bing'));
    audio.play();
}

export function hasSoundOptions() {
    return (!UserAgent.isEdge());
}

export function getDateForUnixTicks(ticks) {
    return new Date(ticks);
}

// returns Unix timestamp in milliseconds
export function getTimestamp() {
    return Date.now();
}

export function getRemainingDaysFromFutureTimestamp(timestamp) {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const futureDate = new Date(timestamp);
    const utcFuture = Date.UTC(futureDate.getFullYear(), futureDate.getMonth(), futureDate.getDate());
    const today = new Date();
    const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

    return Math.floor((utcFuture - utcToday) / MS_PER_DAY);
}

export function getLocaleDateFromUTC(timestamp, format = 'YYYY/MM/DD HH:mm:ss', userTimezone = '') {
    if (!timestamp) {
        return moment.now();
    }
    const timezone = userTimezone ? ' ' + moment().tz(userTimezone).format('z') : '';
    return moment.unix(timestamp).format(format) + timezone;
}

export function replaceHtmlEntities(text) {
    var tagsToReplace = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
    };
    var newtext = text;
    for (var tag in tagsToReplace) {
        if (Reflect.apply({}.hasOwnProperty, this, [tagsToReplace, tag])) {
            var regex = new RegExp(tag, 'g');
            newtext = newtext.replace(regex, tagsToReplace[tag]);
        }
    }
    return newtext;
}

export function isGIFImage(extin) {
    return extin.toLowerCase() === Constants.IMAGE_TYPE_GIF;
}

const removeQuerystringOrHash = (extin) => {
    return extin.split(/[?#]/)[0];
};

export const getFileType = (extin) => {
    const ext = removeQuerystringOrHash(extin.toLowerCase());

    if (Constants.TEXT_TYPES.indexOf(ext) > -1) {
        return FileTypes.TEXT;
    }

    if (Constants.IMAGE_TYPES.indexOf(ext) > -1) {
        return FileTypes.IMAGE;
    }

    if (Constants.AUDIO_TYPES.indexOf(ext) > -1) {
        return FileTypes.AUDIO;
    }

    if (Constants.VIDEO_TYPES.indexOf(ext) > -1) {
        return FileTypes.VIDEO;
    }

    if (Constants.SPREADSHEET_TYPES.indexOf(ext) > -1) {
        return FileTypes.SPREADSHEET;
    }

    if (Constants.CODE_TYPES.indexOf(ext) > -1) {
        return FileTypes.CODE;
    }

    if (Constants.WORD_TYPES.indexOf(ext) > -1) {
        return FileTypes.WORD;
    }

    if (Constants.PRESENTATION_TYPES.indexOf(ext) > -1) {
        return FileTypes.PRESENTATION;
    }

    if (Constants.PDF_TYPES.indexOf(ext) > -1) {
        return FileTypes.PDF;
    }

    if (Constants.PATCH_TYPES.indexOf(ext) > -1) {
        return FileTypes.PATCH;
    }

    if (Constants.SVG_TYPES.indexOf(ext) > -1) {
        return FileTypes.SVG;
    }

    return FileTypes.OTHER;
};

export function getFileIconPath(fileInfo) {
    const fileType = getFileType(fileInfo.extension);

    var icon;
    if (fileType in Constants.ICON_FROM_TYPE) {
        icon = Constants.ICON_FROM_TYPE[fileType];
    } else {
        icon = Constants.ICON_FROM_TYPE.other;
    }

    return icon;
}

export function getIconClassName(fileTypeIn) {
    var fileType = fileTypeIn.toLowerCase();

    if (fileType in Constants.ICON_NAME_FROM_TYPE) {
        return Constants.ICON_NAME_FROM_TYPE[fileType];
    }

    return 'generic';
}

export function toTitleCase(str) {
    function doTitleCase(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
    return str.replace(/\w\S*/g, doTitleCase);
}

function dropAlpha(value) {
    return value.substr(value.indexOf('(') + 1).split(',', 3).join(',');
}

// given '#fffff', returns '255, 255, 255' (no trailing comma)
function toRgbValues(hexStr) {
    const rgbaStr = `${parseInt(hexStr.substr(1, 2), 16)}, ${parseInt(hexStr.substr(3, 2), 16)}, ${parseInt(hexStr.substr(5, 2), 16)}`;
    return rgbaStr;
}

export function applyTheme(theme) {
    if (theme.centerChannelColor) {
        changeCss('.app__body .bg-text-200', 'background:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .user-popover__role', 'background:' + changeOpacity(theme.centerChannelColor, 0.3));
        changeCss('.app__body .svg-text-color', 'fill:' + theme.centerChannelColor);
        changeCss('.app__body .suggestion-list__icon .status.status--group, .app__body .multi-select__note', 'background:' + changeOpacity(theme.centerChannelColor, 0.12));
        changeCss('.app__body .modal-tabs .nav-tabs > li, .app__body .system-notice, .app__body .file-view--single .file__image .image-loaded, .app__body .post .MenuWrapper .dropdown-menu button, .app__body .member-list__popover .more-modal__body, .app__body .alert.alert-transparent, .app__body .table > thead > tr > th, .app__body .table > tbody > tr > td', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.12));
        changeCss('.app__body .post-list__arrows', 'fill:' + changeOpacity(theme.centerChannelColor, 0.3));
        changeCss('.app__body .post .card-icon__container', 'color:' + changeOpacity(theme.centerChannelColor, 0.3));
        changeCss('.app__body .post-image__details .post-image__download svg', 'stroke:' + changeOpacity(theme.centerChannelColor, 0.4));
        changeCss('.app__body .post-image__details .post-image__download svg', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.35));
        changeCss('.app__body .channel-header__links .icon, .app__body .sidebar--right .sidebar--right__subheader .usage__icon, .app__body .more-modal__header svg, .app__body .icon--body', 'fill:' + theme.centerChannelColor);
        changeCss('@media(min-width: 768px){.app__body .post:hover .post__header .post-menu, .app__body .post.post--hovered .post__header .post-menu, .app__body .post.a11y--active .post__header .post-menu', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .help-text, .app__body .post .post-waiting, .app__body .post.post--system .post__body', 'color:' + changeOpacity(theme.centerChannelColor, 0.6));
        changeCss('.app__body .nav-tabs, .app__body .nav-tabs > li.active > a, pp__body .input-group-addon, .app__body .app__content, .app__body .post-create__container .post-create-body .btn-file, .app__body .post-create__container .post-create-footer .msg-typing, .app__body .dropdown-menu, .app__body .popover, .app__body .suggestion-list__item .suggestion-list__ellipsis .suggestion-list__main, .app__body .tip-overlay, .app__body .form-control[disabled], .app__body .form-control[readonly], .app__body fieldset[disabled] .form-control', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .post .post__link', 'color:' + changeOpacity(theme.centerChannelColor, 0.65));
        changeCss('.app__body #archive-link-home, .video-div .video-thumbnail__error', 'background:' + changeOpacity(theme.centerChannelColor, 0.15));
        changeCss('.app__body #post-create', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .mentions--top', 'box-shadow:' + changeOpacity(theme.centerChannelColor, 0.2) + ' 1px -3px 12px');
        changeCss('.app__body .mentions--top', '-webkit-box-shadow:' + changeOpacity(theme.centerChannelColor, 0.2) + ' 1px -3px 12px');
        changeCss('.app__body .mentions--top', '-moz-box-shadow:' + changeOpacity(theme.centerChannelColor, 0.2) + ' 1px -3px 12px');
        changeCss('.app__body .shadow--2', 'box-shadow: 0 20px 30px 0' + changeOpacity(theme.centerChannelColor, 0.1) + ', 0 14px 20px 0 ' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .shadow--2', '-moz-box-shadow: 0  20px 30px 0 ' + changeOpacity(theme.centerChannelColor, 0.1) + ', 0 14px 20px 0 ' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .shadow--2', '-webkit-box-shadow: 0  20px 30px 0 ' + changeOpacity(theme.centerChannelColor, 0.1) + ', 0 14px 20px 0 ' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .shortcut-key, .app__body .post__body hr, .app__body .loading-screen .loading__content .round, .app__body .tutorial__circles .circle', 'background:' + theme.centerChannelColor);
        changeCss('.app__body .channel-header .heading', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .markdown__table tbody tr:nth-child(2n)', 'background:' + changeOpacity(theme.centerChannelColor, 0.07));
        changeCss('.app__body .channel-header__info .header-dropdown__icon', 'color:' + changeOpacity(theme.centerChannelColor, 0.8));
        changeCss('.app__body .post-create__container .post-create-body .send-button.disabled i', 'color:' + changeOpacity(theme.centerChannelColor, 0.4));
        changeCss('.app__body .channel-header .pinned-posts-button svg', 'fill:' + changeOpacity(theme.centerChannelColor, 0.6));
        changeCss('.app__body .channel-header .channel-header_plugin-dropdown svg', 'fill:' + changeOpacity(theme.centerChannelColor, 0.6));
        changeCss('.app__body .file-preview, .app__body .post-image__details, .app__body .markdown__table th, .app__body .markdown__table td, .app__body .modal .settings-modal .settings-table .settings-content .divider-light, .app__body .webhooks__container, .app__body .dropdown-menu, .app__body .modal .modal-header', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.emoji-picker .emoji-picker__header', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .popover.bottom>.arrow', 'border-bottom-color:' + changeOpacity(theme.centerChannelColor, 0.25));
        changeCss('.app__body .btn.btn-transparent', 'color:' + changeOpacity(theme.centerChannelColor, 0.7));
        changeCss('.app__body .popover.right>.arrow', 'border-right-color:' + changeOpacity(theme.centerChannelColor, 0.25));
        changeCss('.app__body .popover.left>.arrow', 'border-left-color:' + changeOpacity(theme.centerChannelColor, 0.25));
        changeCss('.app__body .popover.top>.arrow', 'border-top-color:' + changeOpacity(theme.centerChannelColor, 0.25));
        changeCss('.app__body .popover .popover__row', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('body.app__body, .app__body .custom-textarea', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .input-group-addon', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('@media(min-width: 768px){.app__body .post-list__table .post-list__content .dropdown-menu a:hover, .dropdown-menu > li > button:hover', 'background:' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .MenuWrapper .MenuItem > button:hover, .app__body .Menu .MenuItem > button:hover, .app__body .MenuWrapper .MenuItem > button:focus, .app__body .MenuWrapper .MenuItem > a:hover, .MenuItem > div:hover, .SubMenuItemContainer:not(.hasDivider):hover, .app__body .dropdown-menu div > a:focus, .app__body .dropdown-menu div > a:hover, .dropdown-menu li > a:focus, .app__body .dropdown-menu li > a:hover', 'background:' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .attachment .attachment__content, .app__body .attachment-actions button', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.16));
        changeCss('.app__body .attachment-actions button:focus, .app__body .attachment-actions button:hover', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.5));
        changeCss('.app__body .attachment-actions button:focus, .app__body .attachment-actions button:hover', 'background:' + changeOpacity(theme.centerChannelColor, 0.03));
        changeCss('.app__body .input-group-addon, .app__body .channel-intro .channel-intro__content, .app__body .webhooks__container', 'background:' + changeOpacity(theme.centerChannelColor, 0.05));
        changeCss('.app__body .date-separator .separator__text', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .date-separator .separator__hr, .app__body .modal-footer, .app__body .modal .custom-textarea', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .search-item-container', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .modal .custom-textarea:focus', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.3));
        changeCss('.app__body .channel-intro, .app__body .modal .settings-modal .settings-table .settings-content .divider-dark, .app__body hr, .app__body .modal .settings-modal .settings-table .settings-links, .app__body .modal .settings-modal .settings-table .settings-content .appearance-section .theme-elements__header, .app__body .user-settings .authorized-app:not(:last-child)', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .post.post--comment.other--root.current--user .post-comment, .app__body pre', 'background:' + changeOpacity(theme.centerChannelColor, 0.05));
        changeCss('.app__body .post.post--comment.other--root.current--user .post-comment, .app__body .more-modal__list .more-modal__row, .app__body .member-div:first-child, .app__body .member-div, .app__body .access-history__table .access__report, .app__body .activity-log__table', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('@media(max-width: 1800px){.app__body .inner-wrap.move--left .post.post--comment.same--root', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.07));
        changeCss('.app__body .post.post--hovered', 'background:' + changeOpacity(theme.centerChannelColor, 0.08));
        changeCss('.app__body .attachment__body__wrap.btn-close', 'background:' + changeOpacity(theme.centerChannelColor, 0.08));
        changeCss('.app__body .attachment__body__wrap.btn-close', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('@media(min-width: 768px){.app__body .post.a11y--active, .app__body .modal .settings-modal .settings-table .settings-content .section-min:hover', 'background:' + changeOpacity(theme.centerChannelColor, 0.08));
        changeCss('@media(min-width: 768px){.app__body .post.post--editing', 'background:' + changeOpacity(theme.buttonBg, 0.08));
        changeCss('@media(min-width: 768px){.app__body .post.current--user:hover .post__body ', 'background: transparent;');
        changeCss('.app__body .more-modal__row.more-modal__row--selected, .app__body .date-separator.hovered--before:after, .app__body .date-separator.hovered--after:before, .app__body .new-separator.hovered--after:before, .app__body .new-separator.hovered--before:after', 'background:' + changeOpacity(theme.centerChannelColor, 0.07));
        changeCss('@media(min-width: 768px){.app__body .dropdown-menu>li>a:focus, .app__body .dropdown-menu>li>a:hover', 'background:' + changeOpacity(theme.centerChannelColor, 0.15));
        changeCss('.app__body .form-control[disabled], .app__body .form-control[readonly], .app__body fieldset[disabled] .form-control', 'background:' + changeOpacity(theme.centerChannelColor, 0.1));
        changeCss('.app__body .sidebar--right', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .modal .settings-modal .settings-table .settings-content .appearance-section .theme-elements__body', 'background:' + changeOpacity(theme.centerChannelColor, 0.05));
        if (!UserAgent.isFirefox() && !UserAgent.isInternetExplorer() && !UserAgent.isEdge()) {
            changeCss('body.app__body ::-webkit-scrollbar-thumb', 'background:' + changeOpacity(theme.centerChannelColor, 0.4));
        }
        changeCss('body', 'scrollbar-arrow-color:' + theme.centerChannelColor);
        changeCss('.app__body .post-create__container .post-create-body .btn-file svg, .app__body .post.post--compact .post-image__column .post-image__details svg, .app__body .modal .about-modal .about-modal__logo svg, .app__body .status svg, .app__body .edit-post__actions .icon svg', 'fill:' + theme.centerChannelColor);
        changeCss('.app__body .post-list__new-messages-below', 'background:' + changeColor(theme.centerChannelColor, 0.5));
        changeCss('.app__body .post.post--comment .post__body', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('@media(min-width: 768px){.app__body .post.post--compact.same--root.post--comment .post__content', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .post.post--comment.current--user .post__body', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .emoji-picker', 'color:' + theme.centerChannelColor);
        changeCss('.app__body .emoji-picker', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.app__body .emoji-picker__search-icon', 'color:' + changeOpacity(theme.centerChannelColor, 0.4));
        changeCss('.app__body .emoji-picker__preview, .app__body .emoji-picker__items, .app__body .emoji-picker__search-container', 'border-color:' + changeOpacity(theme.centerChannelColor, 0.2));
        changeCss('.emoji-picker__category .fa:hover', 'color:' + changeOpacity(theme.centerChannelColor, 0.8));
        changeCss('.app__body .emoji-picker__item-wrapper:hover', 'background-color:' + changeOpacity(theme.centerChannelColor, 0.8));
        changeCss('.app__body .icon__postcontent_picker:hover', 'color:' + changeOpacity(theme.centerChannelColor, 0.8));
        changeCss('.app__body .emoji-picker .nav-tabs li a', 'fill:' + theme.centerChannelColor);
        changeCss('.app__body .post .post-collapse__show-more-button', `border-color:${changeOpacity(theme.centerChannelColor, 0.1)}`);
        changeCss('.app__body .post .post-collapse__show-more-line', `background-color:${changeOpacity(theme.centerChannelColor, 0.1)}`);

        if (theme.centerChannelBg) {
            const hoveredPostBg = blendColors(theme.centerChannelBg, theme.centerChannelColor, 0.04);
            const hoveredPostBgLight = blendColors(theme.centerChannelBg, theme.centerChannelColor, 0.04);

            // Fade out effect for collapsed posts that are being hovered over
            changeCss(
                '@media(min-width: 768px){.app__body .post-list__table .post:hover .post-collapse__gradient, ' +
                '.app__body .sidebar-right__body .post:hover .post-collapse__gradient, ' +
                '.app__body .ThreadPane .post:hover .post-collapse__gradient ',
                `background:linear-gradient(${changeOpacity(hoveredPostBg, 0)}, ${hoveredPostBg})`,
            );
            changeCss(
                '@media(min-width: 768px){.app__body .post-list__table .post:hover .post-collapse__show-more, ' +
                '.app__body .sidebar-right__body .post:hover .post-collapse__show-more, ' +
                '.app__body .ThreadPane .post:hover .post-collapse__show-more',
                `background:${hoveredPostBg}`,
            );
            changeCss(
                '@media(max-width: 768px){.app__body .post-list__table .post.current--user:hover .post-collapse__show-more',
                `background:${hoveredPostBgLight}`,
            );
            changeCss(
                '.app__body .post-list__table .post.post--hovered .post-collapse__gradient, ' +
                '.app__body .sidebar-right__body .post.post--hovered .post-collapse__gradient, ' +
                '.app__body .ThreadPane .post.post--hovered .post-collapse__gradient',
                `background:linear-gradient(${changeOpacity(hoveredPostBg, 0)}, ${hoveredPostBg})`,
            );
            changeCss(
                '.app__body .post-list__table .post.post--hovered .post-collapse__show-more, ' +
                '.app__body .sidebar-right__body .post.post--hovered .post-collapse__show-more, ' +
                '.app__body .ThreadPane .post.post--hovered .post-collapse__show-more',
                `background:${hoveredPostBg}`,
            );
        }
    }

    if (theme.newMessageSeparator) {
        changeCss('.app__body .new-separator .separator__text', 'color:' + theme.newMessageSeparator);
        changeCss('.app__body .new-separator .separator__hr', 'border-color:' + changeOpacity(theme.newMessageSeparator, 0.5));
    }

    if (theme.linkColor) {
        changeCss('.app__body .more-modal__list .a11y--focused, .app__body .post.a11y--focused, .app__body .channel-header.a11y--focused, .app__body .post-create.a11y--focused, .app__body .user-popover.a11y--focused, .app__body .post-message__text.a11y--focused, #archive-link-home>a.a11y--focused', 'box-shadow: inset 0 0 1px 3px ' + changeOpacity(theme.linkColor, 0.5) + ', inset 0 0 0 1px ' + theme.linkColor);
        changeCss('.app__body .a11y--focused', 'box-shadow: 0 0 1px 3px ' + changeOpacity(theme.linkColor, 0.5) + ', 0 0 0 1px ' + theme.linkColor);
        changeCss('.app__body .channel-header .channel-header__favorites.inactive:hover, .app__body .channel-header__links > a.active, .app__body a, .app__body a:focus, .app__body a:hover, .app__body .channel-header__links > .color--link.active, .app__body .color--link, .app__body a:focus, .app__body .color--link:hover, .app__body .btn, .app__body .btn:focus, .app__body .btn:hover', 'color:' + theme.linkColor);
        changeCss('.app__body .attachment .attachment__container', 'border-left-color:' + changeOpacity(theme.linkColor, 0.5));
        changeCss('.app__body .channel-header .channel-header_plugin-dropdown a:hover, .app__body .member-list__popover .more-modal__list .more-modal__row:hover', 'background:' + changeOpacity(theme.linkColor, 0.08));
        changeCss('.app__body .channel-header__links .icon:hover, .app__body .channel-header__links > a.active .icon, .app__body .post .post__reply', 'fill:' + theme.linkColor);
        changeCss('.app__body .channel-header__links .icon:hover, .app__body .post .card-icon__container.active svg, .app__body .post .post__reply', 'fill:' + theme.linkColor);
        changeCss('.app__body .channel-header .pinned-posts-button:hover svg', 'fill:' + changeOpacity(theme.linkColor, 0.6));
        changeCss('.app__body .member-list__popover .more-modal__actions svg', 'fill:' + theme.linkColor);
        changeCss('.app__body .modal-tabs .nav-tabs > li.active, .app__body .channel-header .channel-header_plugin-dropdown a:hover, .app__body .member-list__popover .more-modal__list .more-modal__row:hover', 'border-color:' + theme.linkColor);
        changeCss('.app__body .channel-header .channel-header_plugin-dropdown a:hover svg', 'fill:' + theme.linkColor);
        changeCss('.app__body .channel-header .dropdown-toggle:hover .heading, .app__body .channel-header .dropdown-toggle:hover .header-dropdown__icon, .app__body .channel-header__title .open .heading, .app__body .channel-header__info .channel-header__title .open .header-dropdown__icon, .app__body .channel-header__title .open .heading, .app__body .channel-header__info .channel-header__title .open .heading', 'color:' + theme.linkColor);
        changeCss('.emoji-picker__container .icon--emoji.active svg', 'fill:' + theme.linkColor);
        changeCss('.app__body .channel-header .channel-header_plugin-dropdown a:hover .fa', 'color:' + theme.linkColor);
        changeCss('.app__body .post .post-collapse__show-more', `color:${theme.linkColor}`);
        changeCss('.app__body .post .post-attachment-collapse__show-more', `color:${theme.linkColor}`);
        changeCss('.app__body .post .post-collapse__show-more-button:hover', `background-color:${theme.linkColor}`);
        changeCss('.app__body .post-message .group-mention-link', `color:${theme.linkColor}`);
    }

    if (theme.buttonBg) {
        changeCss('.app__body .modal .settings-modal .profile-img__remove:hover, .app__body .DayPicker:not(.DayPicker--interactionDisabled) .DayPicker-Day:not(.DayPicker-Day--disabled):not(.DayPicker-Day--selected):not(.DayPicker-Day--outside):hover:before, .app__body .modal .settings-modal .team-img__remove:hover, .app__body .btn.btn-transparent:hover, .app__body .btn.btn-transparent:active, .app__body .post-image__details .post-image__download svg:hover, .app__body .file-view--single .file__download:hover, .app__body .new-messages__button div, .app__body .btn.btn-primary, .app__body .tutorial__circles .circle.active', 'background:' + theme.buttonBg);
        changeCss('.app__body .system-notice__logo svg', 'fill:' + theme.buttonBg);
        changeCss('.app__body .post-image__details .post-image__download svg:hover', 'border-color:' + theme.buttonBg);
        changeCss('.app__body .btn.btn-primary:hover, .app__body .btn.btn-primary:active, .app__body .btn.btn-primary:focus', 'background:' + changeColor(theme.buttonBg, -0.15));
        changeCss('.app__body .emoji-picker .nav-tabs li.active a, .app__body .emoji-picker .nav-tabs li a:hover', 'fill:' + theme.buttonBg);
        changeCss('.app__body .emoji-picker .nav-tabs > li.active > a', 'border-bottom-color:' + theme.buttonBg + '!important;');
    }

    if (theme.buttonColor) {
        changeCss('.app__body .DayPicker:not(.DayPicker--interactionDisabled) .DayPicker-Day:not(.DayPicker-Day--disabled):not(.DayPicker-Day--selected):not(.DayPicker-Day--outside):hover, .app__body .modal .settings-modal .team-img__remove:hover, .app__body .btn.btn-transparent:hover, .app__body .btn.btn-transparent:active, .app__body .new-messages__button div, .app__body .btn.btn-primary', 'color:' + theme.buttonColor);
        changeCss('.app__body .new-messages__button svg', 'fill:' + theme.buttonColor);
        changeCss('.app__body .post-image__details .post-image__download svg:hover, .app__body .file-view--single .file__download svg', 'stroke:' + theme.buttonColor);
    }

    if (theme.errorTextColor) {
        changeCss('.app__body .error-text, .app__body .modal .settings-modal .settings-table .settings-content .has-error, .app__body .modal .input__help.error, .app__body .color--error, .app__body .has-error .help-block, .app__body .has-error .control-label, .app__body .has-error .radio, .app__body .has-error .checkbox, .app__body .has-error .radio-inline, .app__body .has-error .checkbox-inline, .app__body .has-error.radio label, .app__body .has-error.checkbox label, .app__body .has-error.radio-inline label, .app__body .has-error.checkbox-inline label', 'color:' + theme.errorTextColor);
    }

    if (theme.mentionHighlightBg) {
        changeCss('.app__body .mention--highlight, .app__body .search-highlight', 'background:' + theme.mentionHighlightBg);
        changeCss('.app__body .post.post--comment .post__body.mention-comment', 'border-color:' + theme.mentionHighlightBg);
        changeCss('.app__body .post.post--highlight', 'background:' + changeOpacity(theme.mentionHighlightBg, 0.5));
        changeCss('.app__body .post.post--highlight .post-collapse__gradient', 'background:' + changeOpacity(theme.mentionHighlightBg, 0.5));
        changeCss('.app__body .post.post--highlight .post-collapse__show-more', 'background:' + changeOpacity(theme.mentionHighlightBg, 0.5));
    }

    if (theme.mentionHighlightLink) {
        changeCss('.app__body .mention--highlight .mention-link, .app__body .mention--highlight, .app__body .search-highlight', 'color:' + theme.mentionHighlightLink);
        changeCss('.app__body .mention--highlight .mention-link > a, .app__body .mention--highlight > a, .app__body .search-highlight > a', 'color: inherit');
    }

    if (!theme.codeTheme) {
        theme.codeTheme = Constants.DEFAULT_CODE_THEME;
    }
    updateCodeTheme(theme.codeTheme);

    cssVars({
        variables: {

            // RGB values derived from theme hex values i.e. '255, 255, 255'
            // (do not apply opacity mutations here)
            'away-indicator-rgb': toRgbValues(theme.awayIndicator),
            'button-bg-rgb': toRgbValues(theme.buttonBg),
            'button-color-rgb': toRgbValues(theme.buttonColor),
            'center-channel-bg-rgb': toRgbValues(theme.centerChannelBg),
            'center-channel-color-rgb': toRgbValues(theme.centerChannelColor),
            'dnd-indicator-rgb': toRgbValues(theme.dndIndicator),
            'error-text-color-rgb': toRgbValues(theme.errorTextColor),
            'link-color-rgb': toRgbValues(theme.linkColor),
            'mention-bg-rgb': toRgbValues(theme.mentionBg),
            'mention-color-rgb': toRgbValues(theme.mentionColor),
            'mention-highlight-bg-rgb': toRgbValues(theme.mentionHighlightBg),
            'mention-highlight-link-rgb': toRgbValues(theme.mentionHighlightLink),
            'mention-highlight-bg-mixed-rgb': dropAlpha(blendColors(theme.centerChannelBg, theme.mentionHighlightBg, 0.5)),
            'pinned-highlight-bg-mixed-rgb': dropAlpha(blendColors(theme.centerChannelBg, theme.mentionHighlightBg, 0.24)),
            'own-highlight-bg-rgb': dropAlpha(blendColors(theme.mentionHighlightBg, theme.centerChannelColor, 0.05)),
            'new-message-separator-rgb': toRgbValues(theme.newMessageSeparator),
            'online-indicator-rgb': toRgbValues(theme.onlineIndicator),
            'sidebar-bg-rgb': toRgbValues(theme.sidebarBg),
            'sidebar-header-bg-rgb': toRgbValues(theme.sidebarHeaderBg),
            'sidebar-teambar-bg-rgb': toRgbValues(theme.sidebarTeamBarBg),
            'sidebar-header-text-color-rgb': toRgbValues(theme.sidebarHeaderTextColor),
            'sidebar-text-rgb': toRgbValues(theme.sidebarText),
            'sidebar-text-active-border-rgb': toRgbValues(theme.sidebarTextActiveBorder),
            'sidebar-text-active-color-rgb': toRgbValues(theme.sidebarTextActiveColor),
            'sidebar-text-hover-bg-rgb': toRgbValues(theme.sidebarTextHoverBg),
            'sidebar-unread-text-rgb': toRgbValues(theme.sidebarUnreadText),

            // Hex CSS variables
            'sidebar-bg': theme.sidebarBg,
            'sidebar-text': theme.sidebarText,
            'sidebar-unread-text': theme.sidebarUnreadText,
            'sidebar-text-hover-bg': theme.sidebarTextHoverBg,
            'sidebar-text-active-border': theme.sidebarTextActiveBorder,
            'sidebar-text-active-color': theme.sidebarTextActiveColor,
            'sidebar-header-bg': theme.sidebarHeaderBg,
            'sidebar-teambar-bg': theme.sidebarTeamBarBg,
            'sidebar-header-text-color': theme.sidebarHeaderTextColor,
            'online-indicator': theme.onlineIndicator,
            'away-indicator': theme.awayIndicator,
            'dnd-indicator': theme.dndIndicator,
            'mention-bg': theme.mentionBg,
            'mention-color': theme.mentionColor,
            'center-channel-bg': theme.centerChannelBg,
            'center-channel-color': theme.centerChannelColor,
            'new-message-separator': theme.newMessageSeparator,
            'link-color': theme.linkColor,
            'button-bg': theme.buttonBg,
            'button-color': theme.buttonColor,
            'error-text': theme.errorTextColor,
            'mention-highlight-bg': theme.mentionHighlightBg,
            'mention-highlight-link': theme.mentionHighlightLink,

            // Legacy variables with baked in opacity, do not use!
            'sidebar-text-08': changeOpacity(theme.sidebarText, 0.08),
            'sidebar-text-16': changeOpacity(theme.sidebarText, 0.16),
            'sidebar-text-30': changeOpacity(theme.sidebarText, 0.3),
            'sidebar-text-40': changeOpacity(theme.sidebarText, 0.4),
            'sidebar-text-50': changeOpacity(theme.sidebarText, 0.5),
            'sidebar-text-60': changeOpacity(theme.sidebarText, 0.6),
            'sidebar-text-72': changeOpacity(theme.sidebarText, 0.72),
            'sidebar-text-80': changeOpacity(theme.sidebarText, 0.8),
            'sidebar-header-text-color-80': changeOpacity(theme.sidebarHeaderTextColor, 0.8),
            'center-channel-bg-88': changeOpacity(theme.centerChannelBg, 0.88),
            'center-channel-color-88': changeOpacity(theme.centerChannelColor, 0.88),
            'center-channel-bg-80': changeOpacity(theme.centerChannelBg, 0.8),
            'center-channel-color-80': changeOpacity(theme.centerChannelColor, 0.8),
            'center-channel-color-72': changeOpacity(theme.centerChannelColor, 0.72),
            'center-channel-bg-64': changeOpacity(theme.centerChannelBg, 0.64),
            'center-channel-color-64': changeOpacity(theme.centerChannelColor, 0.64),
            'center-channel-bg-56': changeOpacity(theme.centerChannelBg, 0.56),
            'center-channel-color-56': changeOpacity(theme.centerChannelColor, 0.56),
            'center-channel-color-48': changeOpacity(theme.centerChannelColor, 0.48),
            'center-channel-bg-40': changeOpacity(theme.centerChannelBg, 0.4),
            'center-channel-color-40': changeOpacity(theme.centerChannelColor, 0.4),
            'center-channel-bg-30': changeOpacity(theme.centerChannelBg, 0.3),
            'center-channel-color-32': changeOpacity(theme.centerChannelColor, 0.32),
            'center-channel-bg-20': changeOpacity(theme.centerChannelBg, 0.2),
            'center-channel-color-20': changeOpacity(theme.centerChannelColor, 0.2),
            'center-channel-bg-16': changeOpacity(theme.centerChannelBg, 0.16),
            'center-channel-color-24': changeOpacity(theme.centerChannelColor, 0.24),
            'center-channel-color-16': changeOpacity(theme.centerChannelColor, 0.16),
            'center-channel-bg-08': changeOpacity(theme.centerChannelBg, 0.08),
            'center-channel-color-08': changeOpacity(theme.centerChannelColor, 0.08),
            'center-channel-color-04': changeOpacity(theme.centerChannelColor, 0.04),
            'link-color-08': changeOpacity(theme.linkColor, 0.08),
            'button-bg-88': changeOpacity(theme.buttonBg, 0.88),
            'button-color-88': changeOpacity(theme.buttonColor, 0.88),
            'button-bg-80': changeOpacity(theme.buttonBg, 0.8),
            'button-color-80': changeOpacity(theme.buttonColor, 0.8),
            'button-bg-72': changeOpacity(theme.buttonBg, 0.72),
            'button-color-72': changeOpacity(theme.buttonColor, 0.72),
            'button-bg-64': changeOpacity(theme.buttonBg, 0.64),
            'button-color-64': changeOpacity(theme.buttonColor, 0.64),
            'button-bg-56': changeOpacity(theme.buttonBg, 0.56),
            'button-color-56': changeOpacity(theme.buttonColor, 0.56),
            'button-bg-48': changeOpacity(theme.buttonBg, 0.48),
            'button-color-48': changeOpacity(theme.buttonColor, 0.48),
            'button-bg-40': changeOpacity(theme.buttonBg, 0.4),
            'button-color-40': changeOpacity(theme.buttonColor, 0.4),
            'button-bg-30': changeOpacity(theme.buttonBg, 0.32),
            'button-color-32': changeOpacity(theme.buttonColor, 0.32),
            'button-bg-24': changeOpacity(theme.buttonBg, 0.24),
            'button-color-24': changeOpacity(theme.buttonColor, 0.24),
            'button-bg-16': changeOpacity(theme.buttonBg, 0.16),
            'button-color-16': changeOpacity(theme.buttonColor, 0.16),
            'button-bg-08': changeOpacity(theme.buttonBg, 0.08),
            'button-color-08': changeOpacity(theme.buttonColor, 0.08),
            'button-bg-04': changeOpacity(theme.buttonBg, 0.04),
            'button-color-04': changeOpacity(theme.buttonColor, 0.04),
            'error-text-08': changeOpacity(theme.errorTextColor, 0.08),
            'error-text-12': changeOpacity(theme.errorTextColor, 0.12),
        },
    });
}

export function resetTheme() {
    applyTheme(Preferences.THEMES.denim);
}

function changeCss(className, classValue) {
    let styleEl = document.querySelector('style[data-class="' + className + '"]');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.setAttribute('data-class', className);

        // Append style element to head
        document.head.appendChild(styleEl);
    }

    // Grab style sheet
    const styleSheet = styleEl.sheet;
    const rules = styleSheet.cssRules || styleSheet.rules;
    const style = classValue.substr(0, classValue.indexOf(':'));
    const value = classValue.substr(classValue.indexOf(':') + 1).replace(/!important[;]/g, '');
    const priority = (classValue.match(/!important/) ? 'important' : null);

    for (let i = 0; i < rules.length; i++) {
        if (rules[i].selectorText === className) {
            rules[i].style.setProperty(style, value, priority);
            return;
        }
    }

    let mediaQuery = '';
    if (className.indexOf('@media') >= 0) {
        mediaQuery = '}';
    }
    try {
        styleSheet.insertRule(className + '{' + classValue + '}' + mediaQuery, styleSheet.cssRules.length);
    } catch (e) {
        console.error(e); // eslint-disable-line no-console
    }
}

function updateCodeTheme(userTheme) {
    let cssPath = '';
    Constants.THEME_ELEMENTS.forEach((element) => {
        if (element.id === 'codeTheme') {
            element.themes.forEach((theme) => {
                if (userTheme === theme.id) {
                    cssPath = theme.cssURL;
                }
            });
        }
    });

    const link = document.querySelector('link.code_theme');
    if (link && cssPath !== link.attributes.href) {
        changeCss('code.hljs', 'visibility: hidden');

        const xmlHTTP = new XMLHttpRequest();

        xmlHTTP.open('GET', cssPath, true);
        xmlHTTP.onload = function onLoad() {
            link.href = cssPath;

            if (UserAgent.isFirefox()) {
                link.addEventListener('load', () => {
                    changeCss('code.hljs', 'visibility: visible');
                }, {once: true});
            } else {
                changeCss('code.hljs', 'visibility: visible');
            }
        };

        xmlHTTP.send();
    }
}

export function placeCaretAtEnd(el) {
    el.focus();
    el.selectionStart = el.value.length;
    el.selectionEnd = el.value.length;
}

export function getCaretPosition(el) {
    if (el.selectionStart) {
        return el.selectionStart;
    } else if (document.selection) {
        el.focus();

        var r = document.selection.createRange();
        if (r == null) {
            return 0;
        }

        var re = el.createTextRange();
        var rc = re.duplicate();
        re.moveToBookmark(r.getBookmark());
        rc.setEndPoint('EndToStart', re);

        return rc.text.length;
    }
    return 0;
}

function createHtmlElement(el) {
    return document.createElement(el);
}

function getElementComputedStyle(el) {
    return getComputedStyle(el);
}

function addElementToDocument(el) {
    document.body.appendChild(el);
}

export function copyTextAreaToDiv(textArea) {
    if (!textArea) {
        return null;
    }
    const copy = createHtmlElement('div');
    copy.textContent = textArea.value;
    const style = getElementComputedStyle(textArea);
    [
        'fontFamily',
        'fontSize',
        'fontWeight',
        'wordWrap',
        'whiteSpace',
        'borderLeftWidth',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'paddingRight',
        'paddingLeft',
        'paddingTop',
    ].forEach((key) => {
        copy.style[key] = style[key];
    });
    copy.style.overflow = 'auto';
    copy.style.width = textArea.offsetWidth + 'px';
    copy.style.height = textArea.offsetHeight + 'px';
    copy.style.position = 'absolute';
    copy.style.left = textArea.offsetLeft + 'px';
    copy.style.top = textArea.offsetTop + 'px';
    addElementToDocument(copy);
    return copy;
}

function convertEmToPixels(el, remNum) {
    if (isNaN(remNum)) {
        return 0;
    }
    const styles = getElementComputedStyle(el);
    return remNum * parseFloat(styles.fontSize);
}

export function getCaretXYCoordinate(textArea) {
    if (!textArea) {
        return {x: 0, y: 0};
    }
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const copy = copyTextAreaToDiv(textArea);
    const range = document.createRange();
    range.setStart(copy.firstChild, start);
    range.setEnd(copy.firstChild, end);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const rect = range.getClientRects();
    document.body.removeChild(copy);
    textArea.selectionStart = start;
    textArea.selectionEnd = end;
    textArea.focus();
    return {
        x: Math.floor(rect[0].left - textArea.scrollLeft),
        y: Math.floor(rect[0].top - textArea.scrollTop),
    };
}

export function getViewportSize(win) {
    const w = win || window;
    if (w.innerWidth != null) {
        return {w: w.innerWidth, h: w.innerHeight};
    }
    const {clientWidth, clientHeight} = w.document.body;
    return {w: clientWidth, h: clientHeight};
}

export function offsetTopLeft(el) {
    if (!(el instanceof HTMLElement)) {
        return {top: 0, left: 0};
    }
    const rect = el.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return {top: rect.top + scrollTop, left: rect.left + scrollLeft};
}

export function getSuggestionBoxAlgn(textArea, pxToSubstract = 0) {
    if (!textArea || !(textArea instanceof HTMLElement)) {
        return {
            pixelsToMoveX: 0,
            pixelsToMoveY: 0,
        };
    }

    const {x: caretXCoordinateInTxtArea, y: caretYCoordinateInTxtArea} = getCaretXYCoordinate(textArea);
    const {w: viewportWidth, h: viewportHeight} = getViewportSize();
    const {offsetWidth: textAreaWidth} = textArea;

    const suggestionBoxWidth = Math.min(textAreaWidth, Constants.SUGGESTION_LIST_MAXWIDTH);

    // value in pixels for the offsetLeft for the textArea
    const {top: txtAreaOffsetTop, left: txtAreaOffsetLft} = offsetTopLeft(textArea);

    // how many pixels to the right should be moved the suggestion box
    let pxToTheRight = (caretXCoordinateInTxtArea) - (pxToSubstract);

    // the x coordinate in the viewport of the suggestion box border-right
    const xBoxRightCoordinate = caretXCoordinateInTxtArea + txtAreaOffsetLft + suggestionBoxWidth;

    // if the right-border edge of the suggestion box will overflow the x-axis viewport
    if (xBoxRightCoordinate > viewportWidth) {
        // stick the suggestion list to the very right of the TextArea
        pxToTheRight = textArea.offsetWidth - suggestionBoxWidth;
    }

    return {

        // The rough location of the caret in the textbox
        pixelsToMoveX: Math.max(0, Math.round(pxToTheRight)),
        pixelsToMoveY: Math.round(caretYCoordinateInTxtArea),

        // The line height of the textbox is needed so that the SuggestionList can adjust its position to be below the current line in the textbox
        lineHeight: Number(getComputedStyle(textArea)?.lineHeight.replace('px', '')),

        placementShift: txtAreaOffsetTop + caretYCoordinateInTxtArea + Constants.SUGGESTION_LIST_MAXHEIGHT > viewportHeight - Constants.POST_AREA_HEIGHT,
    };
}

export function getPxToSubstract(char = '@') {
    // depending on the triggering character different values must be substracted
    if (char === '@') {
    // mention name padding-left 2.4rem as stated in suggestion-list__content .suggestion-list__item
        const mentionNamePaddingLft = convertEmToPixels(document.documentElement, Constants.MENTION_NAME_PADDING_LEFT);

        // half of width of avatar stated in .Avatar.Avatar-sm (24px)
        const avatarWidth = Constants.AVATAR_WIDTH * 0.5;
        return 5 + avatarWidth + mentionNamePaddingLft;
    } else if (char === '~') {
        return 39;
    } else if (char === ':') {
        return 32;
    }
    return 0;
}

export function setSelectionRange(input, selectionStart, selectionEnd) {
    if (input.setSelectionRange) {
        input.focus();
        input.setSelectionRange(selectionStart, selectionEnd);
    } else if (input.createTextRange) {
        var range = input.createTextRange();
        range.collapse(true);
        range.moveEnd('character', selectionEnd);
        range.moveStart('character', selectionStart);
        range.select();
    }
}

export function setCaretPosition(input, pos) {
    setSelectionRange(input, pos, pos);
}

export function scrollbarWidth(el) {
    return el.offsetWidth - el.clientWidth;
}

export function isValidUsername(name) {
    let error;
    if (!name) {
        error = {
            id: ValidationErrors.USERNAME_REQUIRED,
        };
    } else if (name.length < Constants.MIN_USERNAME_LENGTH || name.length > Constants.MAX_USERNAME_LENGTH) {
        error = {
            id: ValidationErrors.INVALID_LENGTH,
        };
    } else if (!(/^[a-z0-9.\-_]+$/).test(name)) {
        error = {
            id: ValidationErrors.INVALID_CHARACTERS,
        };
    } else if (!(/[a-z]/).test(name.charAt(0))) { //eslint-disable-line no-negated-condition
        error = {
            id: ValidationErrors.INVALID_FIRST_CHARACTER,
        };
    } else {
        for (const reserved of Constants.RESERVED_USERNAMES) {
            if (name === reserved) {
                error = {
                    id: ValidationErrors.RESERVED_NAME,
                };
                break;
            }
        }
    }

    return error;
}

export function isValidBotUsername(name) {
    let error = isValidUsername(name);
    if (error) {
        return error;
    }

    if (name.endsWith('.')) {
        error = {
            id: ValidationErrors.INVALID_LAST_CHARACTER,
        };
    }

    return error;
}

export function isMobile() {
    return getIsMobileView(store.getState());
}

export function loadImage(url, onLoad, onProgress) {
    const request = new XMLHttpRequest();

    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = onLoad;
    request.onprogress = (e) => {
        if (onProgress) {
            let total = 0;
            if (e.lengthComputable) {
                total = e.total;
            } else {
                total = parseInt(e.target.getResponseHeader('X-Uncompressed-Content-Length'), 10);
            }

            const completedPercentage = Math.round((e.loaded / total) * 100);

            onProgress(completedPercentage);
        }
    };

    request.send();
}

function changeColor(colourIn, amt) {
    var hex = colourIn;
    var lum = amt;

    // validate hex string
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    lum = lum || 0;

    // convert to decimal and change luminosity
    var rgb = '#';
    var c;
    var i;
    for (i = 0; i < 3; i++) {
        c = parseInt(hex.substr(i * 2, 2), 16);
        c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
        rgb += ('00' + c).substr(c.length);
    }

    return rgb;
}

export function getFullName(user) {
    if (user.first_name && user.last_name) {
        return user.first_name + ' ' + user.last_name;
    } else if (user.first_name) {
        return user.first_name;
    } else if (user.last_name) {
        return user.last_name;
    }

    return '';
}

export function getDisplayName(user) {
    if (user.nickname && user.nickname.trim().length > 0) {
        return user.nickname;
    }
    var fullName = getFullName(user);

    if (fullName) {
        return fullName;
    }

    return user.username;
}

export function getLongDisplayName(user) {
    let displayName = '@' + user.username;
    var fullName = getFullName(user);
    if (fullName) {
        displayName = displayName + ' - ' + fullName;
    }
    if (user.nickname && user.nickname.trim().length > 0) {
        displayName = displayName + ' (' + user.nickname + ')';
    }

    if (user.position && user.position.trim().length > 0) {
        displayName = displayName + ' -' + user.position;
    }

    return displayName;
}

export function getLongDisplayNameParts(user) {
    return {
        displayName: '@' + user.username,
        fullName: getFullName(user),
        nickname: user.nickname && user.nickname.trim() ? user.nickname : null,
        position: user.position && user.position.trim() ? user.position : null,
    };
}

/**
 * Gets the display name of the specified user, respecting the TeammateNameDisplay configuration setting
 */
export function getDisplayNameByUser(state, user) {
    const teammateNameDisplay = getTeammateNameDisplaySetting(state);
    if (user) {
        return displayUsername(user, teammateNameDisplay);
    }

    return '';
}

const UserStatusesWeight = {
    online: 0,
    away: 1,
    dnd: 2,
    offline: 3,
    ooo: 3,
    bot: 4,
};

/**
 * Sort users by status then by display name, respecting the TeammateNameDisplay configuration setting
 */
export function sortUsersByStatusAndDisplayName(users, statusesByUserId, teammateNameDisplay) {
    function compareUsers(a, b) {
        const aStatus = a.is_bot ? 'bot' : statusesByUserId[a.id] || UserStatuses.OFFLINE;
        const bStatus = b.is_bot ? 'bot' : statusesByUserId[b.id] || UserStatuses.OFFLINE;

        if (UserStatusesWeight[aStatus] !== UserStatusesWeight[bStatus]) {
            return UserStatusesWeight[aStatus] - UserStatusesWeight[bStatus];
        }

        const aName = displayUsername(a, teammateNameDisplay);
        const bName = displayUsername(b, teammateNameDisplay);

        return aName.localeCompare(bName);
    }

    return users.sort(compareUsers);
}

/**
 * Gets the entire name, including username, full name, and nickname, of the specified user
 */
export function displayEntireNameForUser(user) {
    if (!user) {
        return '';
    }

    let displayName = '';
    const fullName = getFullName(user);

    if (fullName) {
        displayName = ' - ' + fullName;
    }

    if (user.nickname) {
        displayName = displayName + ' (' + user.nickname + ')';
    }

    if (user.position) {
        displayName = displayName + ' - ' + user.position;
    }

    displayName = (
        <span id={'displayedUserName' + user.username}>
            {'@' + user.username}
            <span className='light'>{displayName}</span>
        </span>
    );

    return displayName;
}

/**
 * Gets the full name and nickname of the specified user
 */
export function displayFullAndNicknameForUser(user) {
    if (!user) {
        return '';
    }

    let displayName;
    const fullName = getFullName(user);

    if (fullName && user.nickname) {
        displayName = (
            <span className='light'>{fullName + ' (' + user.nickname + ')'}</span>
        );
    } else if (fullName) {
        displayName = (
            <span className='light'>{fullName}</span>
        );
    } else if (user.nickname) {
        displayName = (
            <span className='light'>{'(' + user.nickname + ')'}</span>
        );
    }

    return displayName;
}

export function imageURLForUser(userId, lastPictureUpdate = 0) {
    return Client4.getUsersRoute() + '/' + userId + '/image?_=' + lastPictureUpdate;
}

export function defaultImageURLForUser(userId) {
    return Client4.getUsersRoute() + '/' + userId + '/image/default';
}

// in contrast to Client4.getTeamIconUrl, for ui logic this function returns null if last_team_icon_update is unset
export function imageURLForTeam(team) {
    return team.last_team_icon_update ? Client4.getTeamIconUrl(team.id, team.last_team_icon_update) : null;
}

// Converts a file size in bytes into a human-readable string of the form '123MB'.
export function fileSizeToString(bytes) {
    // it's unlikely that we'll have files bigger than this
    if (bytes > 1024 ** 4) {
        // check if file is smaller than 10 to display fractions
        if (bytes < (1024 ** 4) * 10) {
            return (Math.round((bytes / (1024 ** 4)) * 10) / 10) + 'TB';
        }
        return Math.round(bytes / (1024 ** 4)) + 'TB';
    } else if (bytes > 1024 ** 3) {
        if (bytes < (1024 ** 3) * 10) {
            return (Math.round((bytes / (1024 ** 3)) * 10) / 10) + 'GB';
        }
        return Math.round(bytes / (1024 ** 3)) + 'GB';
    } else if (bytes > 1024 ** 2) {
        if (bytes < (1024 ** 2) * 10) {
            return (Math.round((bytes / (1024 ** 2)) * 10) / 10) + 'MB';
        }
        return Math.round(bytes / (1024 ** 2)) + 'MB';
    } else if (bytes > 1024) {
        return Math.round(bytes / 1024) + 'KB';
    }
    return bytes + 'B';
}

// Generates a RFC-4122 version 4 compliant globally unique identifier.
export function generateId() {
    // implementation taken from http://stackoverflow.com/a/2117523
    var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

    id = id.replace(/[xy]/g, (c) => {
        var r = Math.floor(Math.random() * 16);

        var v;
        if (c === 'x') {
            v = r;
        } else {
            v = (r & 0x3) | 0x8;
        }

        return v.toString(16);
    });

    return id;
}

export function getDirectChannelName(id, otherId) {
    let handle;

    if (otherId > id) {
        handle = id + '__' + otherId;
    } else {
        handle = otherId + '__' + id;
    }

    return handle;
}

// Used to get the id of the other user from a DM channel
export function getUserIdFromChannelName(channel) {
    return getUserIdFromChannelId(channel.name);
}

// Used to get the id of the other user from a DM channel id (id1_id2)
export function getUserIdFromChannelId(channelId, currentUserId = getCurrentUserId(store.getState())) {
    var ids = channelId.split('__');
    var otherUserId = '';
    if (ids[0] === currentUserId) {
        otherUserId = ids[1];
    } else {
        otherUserId = ids[0];
    }

    return otherUserId;
}

// Should be refactored, seems to make most sense to wrap TextboxLinks in a connect(). To discuss
export function isFeatureEnabled(feature, state) {
    return getBool(state, Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, Constants.FeatureTogglePrefix + feature.label);
}

export function fillArray(value, length) {
    const arr = [];

    for (let i = 0; i < length; i++) {
        arr.push(value);
    }

    return arr;
}

// Checks if a data transfer contains files not text, folders, etc..
// Slightly modified from http://stackoverflow.com/questions/6848043/how-do-i-detect-a-file-is-being-dragged-rather-than-a-draggable-element-on-my-pa
export function isFileTransfer(files) {
    if (UserAgent.isInternetExplorer() || UserAgent.isEdge()) {
        return files.types != null && files.types.includes('Files');
    }

    return files.types != null && (files.types.indexOf ? files.types.indexOf('Files') !== -1 : files.types.contains('application/x-moz-file'));
}

export function isUriDrop(dataTransfer) {
    if (UserAgent.isInternetExplorer() || UserAgent.isEdge() || UserAgent.isSafari()) {
        for (let i = 0; i < dataTransfer.items.length; i++) {
            if (dataTransfer.items[i].type === 'text/uri-list') {
                return true;
            }
        }
    }
    return false; // we don't care about others, they handle as we want it
}

export function clearFileInput(elm) {
    // clear file input for all modern browsers
    try {
        elm.value = '';
        if (elm.value) {
            elm.type = 'text';
            elm.type = 'file';
        }
    } catch (e) {
        // Do nothing
    }
}

export function isPostEphemeral(post) {
    return post.type === Constants.PostTypes.EPHEMERAL || post.state === Posts.POST_DELETED;
}

export function getRootId(post) {
    return post.root_id === '' ? post.id : post.root_id;
}

export function getRootPost(postList) {
    return postList.find((post) => post.root_id === '');
}

export function localizeMessage(id, defaultMessage) {
    const state = store.getState();

    const locale = getCurrentLocale(state);
    const translations = getTranslations(state, locale);

    if (!translations || !(id in translations)) {
        return defaultMessage || id;
    }

    return translations[id];
}

export function localizeAndFormatMessage(id, defaultMessage, template) {
    const base = localizeMessage(id, defaultMessage);

    if (!template) {
        return base;
    }

    return base.replace(/{[\w]+}/g, (match) => {
        const key = match.substr(1, match.length - 2);
        return template[key] || match;
    });
}

export function mod(a, b) {
    return ((a % b) + b) % b;
}

export const REACTION_PATTERN = /^(\+|-):([^:\s]+):\s*$/;

export function getPasswordConfig(config) {
    return {
        minimumLength: parseInt(config.PasswordMinimumLength, 10),
        requireLowercase: config.PasswordRequireLowercase === 'true',
        requireUppercase: config.PasswordRequireUppercase === 'true',
        requireNumber: config.PasswordRequireNumber === 'true',
        requireSymbol: config.PasswordRequireSymbol === 'true',
    };
}

export function isValidPassword(password, passwordConfig) {
    let errorId = t('user.settings.security.passwordError');
    let valid = true;
    const minimumLength = passwordConfig.minimumLength || Constants.MIN_PASSWORD_LENGTH;

    if (password.length < minimumLength || password.length > Constants.MAX_PASSWORD_LENGTH) {
        valid = false;
    }

    if (passwordConfig.requireLowercase) {
        if (!password.match(/[a-z]/)) {
            valid = false;
        }

        errorId += 'Lowercase';
    }

    if (passwordConfig.requireUppercase) {
        if (!password.match(/[A-Z]/)) {
            valid = false;
        }

        errorId += 'Uppercase';
    }

    if (passwordConfig.requireNumber) {
        if (!password.match(/[0-9]/)) {
            valid = false;
        }

        errorId += 'Number';
    }

    if (passwordConfig.requireSymbol) {
        if (!password.match(/[ !"\\#$%&'()*+,-./:;<=>?@[\]^_`|~]/)) {
            valid = false;
        }

        errorId += 'Symbol';
    }

    let error;
    if (!valid) {
        error = (
            <FormattedMessage
                id={errorId}
                default='Your password must contain between {min} and {max} characters.'
                values={{
                    min: minimumLength,
                    max: Constants.MAX_PASSWORD_LENGTH,
                }}
            />
        );
    }

    return {valid, error};
}

function isChannelOrPermalink(link) {
    let match = (/\/([^/]+)\/channels\/(\S+)/).exec(link);
    if (match) {
        return {
            type: 'channel',
            teamName: match[1],
            channelName: match[2],
        };
    }
    match = (/\/([^/]+)\/pl\/(\w+)/).exec(link);
    if (match) {
        return {
            type: 'permalink',
            teamName: match[1],
            postId: match[2],
        };
    }
    return match;
}

export async function handleFormattedTextClick(e, currentRelativeTeamUrl = '') {
    const hashtagAttribute = e.target.getAttributeNode('data-hashtag');
    const linkAttribute = e.target.getAttributeNode('data-link');
    const channelMentionAttribute = e.target.getAttributeNode('data-channel-mention');

    if (hashtagAttribute) {
        e.preventDefault();

        store.dispatch(searchForTerm(hashtagAttribute.value));
    } else if (linkAttribute) {
        const MIDDLE_MOUSE_BUTTON = 1;

        if (!(e.button === MIDDLE_MOUSE_BUTTON || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) {
            e.preventDefault();

            const state = store.getState();
            const user = getCurrentUser(state);
            if (isSystemAdmin(user.roles)) {
                const match = isChannelOrPermalink(linkAttribute.value);
                if (match) {
                    // Get team by name
                    const {teamName} = match;
                    let team = getTeamByName(state, teamName);
                    if (!team) {
                        const {data: teamData} = await store.dispatch(getTeamByNameAction(teamName));
                        team = teamData;
                    }
                    if (team && team.delete_at === 0) {
                        let channel;

                        // Handle channel url - Get channel data from channel name
                        if (match.type === 'channel') {
                            const {channelName} = match;
                            channel = getChannelsNameMapInTeam(state, team.id)[channelName];
                            if (!channel) {
                                const {data: channelData} = await store.dispatch(getChannelByNameAndTeamName(teamName, channelName, true));
                                channel = channelData;
                            }
                        } else { // Handle permalink - Get channel data from post
                            const {postId} = match;
                            let post = getPost(state, postId);
                            if (!post) {
                                const {data: postData} = await store.dispatch(getPostAction(match.postId));
                                post = postData;
                            }
                            if (post) {
                                channel = getChannel(state, post.channel_id);
                                if (!channel) {
                                    const {data: channelData} = await store.dispatch(getChannelAction(post.channel_id));
                                    channel = channelData;
                                }
                            }
                        }
                        if (channel && channel.type === Constants.PRIVATE_CHANNEL) {
                            let member = getMyChannelMemberships(state)[channel.id];
                            if (!member) {
                                const membership = await store.dispatch(getChannelMember(channel.id, getCurrentUserId(state)));
                                if ('data' in membership) {
                                    member = membership.data;
                                }
                            }
                            if (!member) {
                                const {data} = await store.dispatch(joinPrivateChannelPrompt(team, channel, false));
                                if (data.join) {
                                    let error = false;
                                    if (!getTeamMemberships(state)[team.id]) {
                                        const joinTeamResult = await store.dispatch(addUserToTeam(team.id, user.id));
                                        error = joinTeamResult.error;
                                    }
                                    if (!error) {
                                        await store.dispatch(joinChannel(user.id, team.id, channel.id, channel.name));
                                    }
                                } else {
                                    return;
                                }
                            }
                        }
                    }
                }
            }

            e.stopPropagation();
            browserHistory.push(linkAttribute.value);
        }
    } else if (channelMentionAttribute) {
        e.preventDefault();
        browserHistory.push(currentRelativeTeamUrl + '/channels/' + channelMentionAttribute.value);
    }
}

export function isEmptyObject(object) {
    if (!object) {
        return true;
    }

    if (Object.keys(object).length === 0) {
        return true;
    }

    return false;
}

export function removePrefixFromLocalStorage(prefix) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i).startsWith(prefix)) {
            keys.push(localStorage.key(i));
        }
    }

    for (let i = 0; i < keys.length; i++) {
        localStorage.removeItem(keys[i]);
    }
}

export function copyToClipboard(data) {
    // Attempt to use the newer clipboard API when possible
    const clipboard = navigator.clipboard;
    if (clipboard) {
        clipboard.writeText(data);
        return;
    }

    // creates a tiny temporary text area to copy text out of
    // see https://stackoverflow.com/a/30810322/591374 for details
    const textArea = document.createElement('textarea');
    textArea.style.position = 'fixed';
    textArea.style.top = 0;
    textArea.style.left = 0;
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = 0;
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.value = data;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
}

export function moveCursorToEnd(e) {
    const val = e.target.value;
    if (val.length) {
        e.target.value = '';
        e.target.value = val;
    }
}

export function compareChannels(a, b) {
    const aDisplayName = a.display_name.toUpperCase();
    const bDisplayName = b.display_name.toUpperCase();
    const result = aDisplayName.localeCompare(bDisplayName);
    if (result !== 0) {
        return result;
    }

    const aName = a.name.toUpperCase();
    const bName = b.name.toUpperCase();
    return aName.localeCompare(bName);
}

export function setCSRFFromCookie() {
    if (typeof document !== 'undefined' && typeof document.cookie !== 'undefined') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith('MMCSRF=')) {
                Client4.setCSRF(cookie.replace('MMCSRF=', ''));
                break;
            }
        }
    }
}

/**
 * Returns true if in dev mode, false otherwise.
 */
export function isDevMode(state = store.getState()) {
    const config = getConfig(state);
    return config.EnableDeveloper === 'true';
}

/**
 * Get closest parent which match selector
 */
export function getClosestParent(elem, selector) {
    // Element.matches() polyfill
    if (!Element.prototype.matches) {
        Element.prototype.matches =
            Element.prototype.matchesSelector ||
            Element.prototype.mozMatchesSelector ||
            Element.prototype.msMatchesSelector ||
            Element.prototype.oMatchesSelector ||
            Element.prototype.webkitMatchesSelector ||
            ((s) => {
                const matches = (this.document || this.ownerDocument).querySelectorAll(s);
                let i = matches.length - 1;
                while (i >= 0 && matches.item(i) !== this) {
                    i--;
                }
                return i > -1;
            });
    }

    // Get the closest matching element
    let currentElem = elem;
    for (; currentElem && currentElem !== document; currentElem = currentElem.parentNode) {
        if (currentElem.matches(selector)) {
            return currentElem;
        }
    }
    return null;
}

const BOLD_MD = '**';
const ITALIC_MD = '*';

/**
 * Applies bold/italic/link markdown on textbox associated with event and returns
 * modified text alongwith modified selection positions.
 */
export function applyHotkeyMarkdown(e) {
    e.preventDefault();

    if (e.keyCode === Constants.KeyCodes.B[1] || e.keyCode === Constants.KeyCodes.I[1]) {
        return applyBoldItalicMarkdown(e);
    } else if (e.keyCode === Constants.KeyCodes.K[1]) {
        return applyLinkMarkdown(e);
    }

    throw Error('Unsupported key code: ' + e.keyCode);
}

function applyBoldItalicMarkdown(e) {
    const el = e.target;
    const {selectionEnd, selectionStart, value} = el;

    // <prefix> <selection> <suffix>
    const prefix = value.substring(0, selectionStart);
    const selection = value.substring(selectionStart, selectionEnd);
    const suffix = value.substring(selectionEnd);

    // Is it italic hot key on existing bold markdown? i.e. italic on **haha**
    let isItalicFollowedByBold = false;
    let delimiter = '';

    if (e.keyCode === Constants.KeyCodes.B[1]) {
        delimiter = BOLD_MD;
    } else if (e.keyCode === Constants.KeyCodes.I[1]) {
        delimiter = ITALIC_MD;
        isItalicFollowedByBold = prefix.endsWith(BOLD_MD) && suffix.startsWith(BOLD_MD);
    }

    // Does the selection have current hotkey's markdown?
    const hasCurrentMarkdown = prefix.endsWith(delimiter) && suffix.startsWith(delimiter);

    // Does current selection have both of the markdown around it? i.e. ***haha***
    const hasItalicAndBold = prefix.endsWith(BOLD_MD + ITALIC_MD) && suffix.startsWith(BOLD_MD + ITALIC_MD);

    let newValue = '';
    let newStart = 0;
    let newEnd = 0;
    if (hasItalicAndBold || (hasCurrentMarkdown && !isItalicFollowedByBold)) {
        // message already has the markdown; remove it
        newValue = prefix.substring(0, prefix.length - delimiter.length) + selection + suffix.substring(delimiter.length);
        newStart = selectionStart - delimiter.length;
        newEnd = selectionEnd - delimiter.length;
    } else {
        // Add italic or bold markdown
        newValue = prefix + delimiter + selection + delimiter + suffix;
        newStart = selectionStart + delimiter.length;
        newEnd = selectionEnd + delimiter.length;
    }

    return {
        message: newValue,
        selectionStart: newStart,
        selectionEnd: newEnd,
    };
}

function applyLinkMarkdown(e) {
    const el = e.target;
    const {selectionEnd, selectionStart, value} = el;

    // <prefix> <selection> <suffix>
    const prefix = value.substring(0, selectionStart);
    const selection = value.substring(selectionStart, selectionEnd);
    const suffix = value.substring(selectionEnd);

    const delimiterStart = '[';
    const delimiterEnd = '](url)';

    // Does the selection have link markdown?
    const hasMarkdown = prefix.endsWith(delimiterStart) && suffix.startsWith(delimiterEnd);

    let newValue = '';
    let newStart = 0;
    let newEnd = 0;

    // When url is to be selected in [...](url), selection cursors need to shift by this much.
    const urlShift = delimiterStart.length + 2; // ']'.length + ']('.length
    if (hasMarkdown) {
        // message already has the markdown; remove it
        newValue = prefix.substring(0, prefix.length - delimiterStart.length) + selection + suffix.substring(delimiterEnd.length);
        newStart = selectionStart - delimiterStart.length;
        newEnd = selectionEnd - delimiterStart.length;
    } else if (value.length === 0) {
        // no input; Add [|](url)
        newValue = delimiterStart + delimiterEnd;
        newStart = delimiterStart.length;
        newEnd = delimiterStart.length;
    } else if (selectionStart < selectionEnd) {
        // there is something selected; put markdown around it and preserve selection
        newValue = prefix + delimiterStart + selection + delimiterEnd + suffix;
        newStart = selectionEnd + urlShift;
        newEnd = newStart + urlShift;
    } else {
        // nothing is selected
        const spaceBefore = prefix.charAt(prefix.length - 1) === ' ';
        const spaceAfter = suffix.charAt(0) === ' ';
        const cursorBeforeWord = ((selectionStart !== 0 && spaceBefore && !spaceAfter) ||
                                  (selectionStart === 0 && !spaceAfter));
        const cursorAfterWord = ((selectionEnd !== value.length && spaceAfter && !spaceBefore) ||
                                 (selectionEnd === value.length && !spaceBefore));

        if (cursorBeforeWord) {
            // cursor before a word
            const word = value.substring(selectionStart, findWordEnd(value, selectionStart));

            newValue = prefix + delimiterStart + word + delimiterEnd + suffix.substring(word.length);
            newStart = selectionStart + word.length + urlShift;
            newEnd = newStart + urlShift;
        } else if (cursorAfterWord) {
            // cursor after a word
            const cursorAtEndOfLine = (selectionStart === selectionEnd && selectionEnd === value.length);
            if (cursorAtEndOfLine) {
                // cursor at end of line
                newValue = value + ' ' + delimiterStart + delimiterEnd;
                newStart = selectionEnd + 1 + delimiterStart.length;
                newEnd = newStart;
            } else {
                // cursor not at end of line
                const word = value.substring(findWordStart(value, selectionStart), selectionStart);

                newValue = prefix.substring(0, prefix.length - word.length) + delimiterStart + word + delimiterEnd + suffix;
                newStart = selectionStart + urlShift;
                newEnd = newStart + urlShift;
            }
        } else {
            // cursor is in between a word
            const wordStart = findWordStart(value, selectionStart);
            const wordEnd = findWordEnd(value, selectionStart);
            const word = value.substring(wordStart, wordEnd);

            newValue = prefix.substring(0, wordStart) + delimiterStart + word + delimiterEnd + value.substring(wordEnd);
            newStart = wordEnd + urlShift;
            newEnd = newStart + urlShift;
        }
    }

    return {
        message: newValue,
        selectionStart: newStart,
        selectionEnd: newEnd,
    };
}

function findWordEnd(text, start) {
    const wordEnd = text.indexOf(' ', start);
    return wordEnd === -1 ? text.length : wordEnd;
}

function findWordStart(text, start) {
    const wordStart = text.lastIndexOf(' ', start - 1) + 1;
    return wordStart === -1 ? 0 : wordStart;
}

/**
 * Adjust selection to correct text when there is Italic markdown (_) around selected text.
 */
export function adjustSelection(inputBox, e) {
    const el = e.target;
    const {selectionEnd, selectionStart, value} = el;

    if (selectionStart === selectionEnd) {
        // nothing selected.
        return;
    }

    e.preventDefault();

    const firstUnderscore = value.charAt(selectionStart) === '_';
    const lastUnderscore = value.charAt(selectionEnd - 1) === '_';

    const spaceBefore = value.charAt(selectionStart - 1) === ' ';
    const spaceAfter = value.charAt(selectionEnd) === ' ';

    if (firstUnderscore && lastUnderscore && (spaceBefore || spaceAfter)) {
        setSelectionRange(inputBox, selectionStart + 1, selectionEnd - 1);
    }
}

export function getNextBillingDate() {
    const nextBillingDate = moment().add(1, 'months').startOf('month');
    return nextBillingDate.format('MMM D, YYYY');
}

export function stringToNumber(s) {
    if (!s) {
        return 0;
    }

    return parseInt(s, 10);
}

export function renderPurchaseLicense() {
    return (
        <div className='purchase-card'>
            <PurchaseLink
                eventID='post_trial_purchase_license'
                buttonTextElement={
                    <FormattedMessage
                        id='admin.license.trialCard.purchase_license'
                        defaultMessage='Purchase a license'
                    />
                }
            />
            <ContactUsButton
                eventID='post_trial_contact_sales'
            />
        </div>
    );
}

export function deleteKeysFromObject(value, keys) {
    for (const key of keys) {
        delete value[key];
    }
    return value;
}

function isSelection() {
    const selection = window.getSelection();
    return selection.type === 'Range';
}

/*
 * Returns false when the element clicked or its ancestors
 * is a potential click target (link, button, image, etc..)
 * but not the events currentTarget
 * and true in any other case.
 *
 * @param {string} selector - CSS selector of elements not eligible for click
 * @returns {function}
 */
export function makeIsEligibleForClick(selector = '') {
    return (event) => {
        const currentTarget = event.currentTarget;
        let node = event.target;

        if (isSelection()) {
            return false;
        }

        if (node === currentTarget) {
            return true;
        }

        // in the case of a react Portal
        if (!currentTarget.contains(node)) {
            return false;
        }

        // traverses the targets parents up to currentTarget to see
        // if any of them is a potentially clickable element
        while (node) {
            if (!node || node === currentTarget) {
                break;
            }

            if (
                CLICKABLE_ELEMENTS.includes(node.tagName.toLowerCase()) ||
                node.getAttribute('role') === 'button' ||
                (selector && node.matches(selector))
            ) {
                return false;
            }

            node = node.parentNode;
        }

        return true;
    };
}

/*
 * Returns the minimal number of zeroes needed to render a number,
 * up to the given number of places.
 * e.g.
 * numberToFixedDynamic(3.12345, 4) -> 3.1235
 * numberToFixedDynamic(3.01000, 4) -> 3.01
 * numberToFixedDynamic(3.01000, 1) -> 3
 *
 * @param {number} num - number to render as string
 * @param {number} places - maximum number of decimal places to render
 * @returns {number}
 */
export function numberToFixedDynamic(num, places) {
    const str = num.toFixed(Math.max(places, 0));
    if (!str.includes('.')) {
        return str;
    }
    let indexToExclude = -1;
    let i = str.length - 1;
    while (str[i] === '0') {
        indexToExclude = i;
        i -= 1;
    }
    if (str[i] === '.') {
        indexToExclude -= 1;
    }
    if (indexToExclude === -1) {
        return str;
    }
    return str.slice(0, indexToExclude);
}
