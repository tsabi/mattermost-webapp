// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import localforage from 'localforage';

import * as TIMEOUTS from '../fixtures/timeouts';
import {isMac} from '../utils';

// ***********************************************************
// Read more: https://on.cypress.io/custom-commands
// ***********************************************************

Cypress.Commands.add('logout', () => {
    cy.get('#logout').click({force: true});
});

Cypress.Commands.add('getCurrentUserId', () => {
    return cy.wrap(new Promise((resolve) => {
        cy.getCookie('MMUSERID').then((cookie) => {
            resolve(cookie.value);
        });
    }));
});

// ***********************************************************
// Key Press
// ***********************************************************

// Type Cmd or Ctrl depending on OS
Cypress.Commands.add('typeCmdOrCtrl', () => {
    typeCmdOrCtrlInt('#post_textbox');
});

Cypress.Commands.add('typeCmdOrCtrlForEdit', () => {
    typeCmdOrCtrlInt('#edit_textbox');
});

function typeCmdOrCtrlInt(textboxSelector) {
    let cmdOrCtrl;
    if (isMac()) {
        cmdOrCtrl = '{cmd}';
    } else {
        cmdOrCtrl = '{ctrl}';
    }

    cy.get(textboxSelector).type(cmdOrCtrl, {release: false});
}

Cypress.Commands.add('cmdOrCtrlShortcut', {prevSubject: true}, (subject, text) => {
    const cmdOrCtrl = isMac() ? '{cmd}' : '{ctrl}';
    return cy.get(subject).type(`${cmdOrCtrl}${text}`);
});

// ***********************************************************
// Post
// ***********************************************************

Cypress.Commands.add('postMessage', (message) => {
    cy.get('#postListContent').should('be.visible');
    postMessageAndWait('#post_textbox', message);
});

Cypress.Commands.add('postMessageReplyInRHS', (message) => {
    cy.get('#sidebar-right').should('be.visible');
    postMessageAndWait('#reply_textbox', message, true);
});

Cypress.Commands.add('uiPostMessageQuickly', (message) => {
    cy.get('#post_textbox', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').clear().
        invoke('val', message).wait(TIMEOUTS.HALF_SEC).type(' {backspace}{enter}');
    cy.waitUntil(() => {
        return cy.get('#post_textbox').then((el) => {
            return el[0].textContent === '';
        });
    });
});

function postMessageAndWait(textboxSelector, message, isComment = false) {
    // Add explicit wait to let the page load freely since `cy.get` seemed to block
    // some operation which caused to prolong complete page loading.
    cy.wait(TIMEOUTS.HALF_SEC);
    cy.get(textboxSelector, {timeout: TIMEOUTS.HALF_MIN}).should('be.visible');

    // # Type then wait for a while for the draft to be saved (async) into the local storage
    cy.get(textboxSelector).clear().type(message).wait(TIMEOUTS.ONE_SEC);

    // If posting a comment, wait for comment draft from localforage before hitting enter
    if (isComment) {
        waitForCommentDraft(message);
    }

    cy.get(textboxSelector).should('have.value', message).type('{enter}').wait(TIMEOUTS.HALF_SEC);

    cy.get(textboxSelector).invoke('val').then((value) => {
        if (value.length > 0 && value === message) {
            cy.get(textboxSelector).type('{enter}').wait(TIMEOUTS.HALF_SEC);
        }
    });
    cy.waitUntil(() => {
        return cy.get(textboxSelector).then((el) => {
            return el[0].textContent === '';
        });
    });
}

// Wait until comment message is saved as draft from the localforage
function waitForCommentDraft(message) {
    const draftPrefix = 'comment_draft_';

    cy.waitUntil(async () => {
        // Get all keys from localforage
        const keys = await localforage.keys();

        // Get all draft comments matching the predefined prefix
        const draftPromises = keys.
            filter((key) => key.includes(draftPrefix)).
            map((key) => localforage.getItem(key));
        const draftItems = await Promise.all(draftPromises);

        // Get the exact draft comment
        const commentDraft = draftItems.filter((item) => {
            const draft = JSON.parse(item);

            if (draft && draft.value && draft.value.message) {
                return draft.value.message === message;
            }

            return false;
        });

        return Boolean(commentDraft);
    });
}

function waitUntilPermanentPost() {
    // Add explicit wait to let the page load freely since `cy.get` seemed to block
    // some operation which caused to prolong complete page loading.
    cy.wait(TIMEOUTS.HALF_SEC);
    cy.get('#postListContent', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
    cy.waitUntil(() => cy.findAllByTestId('postView').last().then((el) => !(el[0].id.includes(':'))));
}

Cypress.Commands.add('getLastPost', () => {
    waitUntilPermanentPost();

    return cy.findAllByTestId('postView').last();
});

Cypress.Commands.add('getLastPostId', () => {
    waitUntilPermanentPost();

    cy.findAllByTestId('postView').last().should('have.attr', 'id').and('not.include', ':').
        invoke('replace', 'post_', '');
});

/**
 * @see `cy.uiWaitUntilMessagePostedIncludes` at ./ui_commands.d.ts
 */
Cypress.Commands.add('uiWaitUntilMessagePostedIncludes', (message) => {
    const checkFn = () => {
        return cy.getLastPost().then((el) => {
            const postedMessageEl = el.find('.post-message__text')[0];
            return Boolean(postedMessageEl && postedMessageEl.textContent.includes(message));
        });
    };

    // Wait for 5 seconds with 500ms check interval
    const options = {
        timeout: TIMEOUTS.FIVE_SEC,
        interval: TIMEOUTS.HALF_SEC,
        errorMsg: `Expected "${message}" to be in the last message posted but not found.`,
    };

    return cy.waitUntil(checkFn, options);
});

Cypress.Commands.add('getLastPostIdRHS', () => {
    waitUntilPermanentPost();

    cy.get('#rhsContainer .post-right-comments-container > div').last().should('have.attr', 'id').and('not.include', ':').
        invoke('replace', 'rhsPost_', '');
});

/**
* Get post ID based on index of post list
* @param {Integer} index
* zero (0)         : oldest post
* positive number  : from old to latest post
* negative number  : from new to oldest post
*/
Cypress.Commands.add('getNthPostId', (index = 0) => {
    waitUntilPermanentPost();

    cy.findAllByTestId('postView').eq(index).should('have.attr', 'id').and('not.include', ':').
        invoke('replace', 'post_', '');
});

Cypress.Commands.add('uiGetNthPost', (index) => {
    waitUntilPermanentPost();

    return cy.findAllByTestId('postView').eq(index);
});

/**
 * Post message from a file instantly post a message in a textbox
 * instead of typing into it which takes longer period of time.
 * @param {String} file - includes path and filename relative to cypress/fixtures
 * @param {String} target - either #post_textbox or #reply_textbox
 */
Cypress.Commands.add('postMessageFromFile', (file, target = '#post_textbox') => {
    cy.fixture(file, 'utf-8').then((text) => {
        cy.get(target).clear().invoke('val', text).wait(TIMEOUTS.HALF_SEC).type(' {backspace}{enter}').should('have.text', '');
    });
});

/**
 * Compares HTML content of a last post against the given file
 * instead of typing into it which takes longer period of time.
 * @param {String} file - includes path and filename relative to cypress/fixtures
 */
Cypress.Commands.add('compareLastPostHTMLContentFromFile', (file, timeout = TIMEOUTS.TEN_SEC) => {
    // * Verify that HTML Content is correct
    cy.getLastPostId().then((postId) => {
        const postMessageTextId = `#postMessageText_${postId}`;

        cy.fixture(file, 'utf-8').then((expectedHtml) => {
            cy.get(postMessageTextId, {timeout}).should('have.html', expectedHtml.replace(/\n$/, ''));
        });
    });
});

// ***********************************************************
// DM
// ***********************************************************

/**
 * Sends a DM to a given user
 * @param {User} user - the user that should get the message
 * @param {String} message - the message to send
 */
Cypress.Commands.add('sendDirectMessageToUser', (user, message) => {
    // # Open a new direct message with firstDMUser
    cy.uiAddDirectMessage().click().wait(TIMEOUTS.ONE_SEC);
    cy.findByRole('dialog', {name: 'Direct Messages'}).should('be.visible').wait(TIMEOUTS.ONE_SEC);

    // # Type username
    cy.findByRole('textbox', {name: 'Search for people'}).click({force: true}).
        type(user.username).wait(TIMEOUTS.ONE_SEC);

    // * Expect user count in the list to be 1
    cy.get('#multiSelectList').
        should('be.visible').
        children().
        should('have.length', 1);

    // # Select first user in the list
    cy.get('body').
        type('{downArrow}').
        type('{enter}');

    // # Click on "Go" in the group message's dialog to begin the conversation
    cy.get('#saveItems').click();

    // * Expect the channel title to be the user's username
    // In the channel header, it seems there is a space after the username, justifying the use of contains.text instead of have.text
    cy.get('#channelHeaderTitle').should('be.visible').and('contain.text', user.username);

    // # Type message and send it to the user
    cy.get('#post_textbox').
        type(message).
        type('{enter}');
});

/**
 * Sends a GM to a given user list
 * @param {User[]} users - the users that should get the message
 * @param {String} message - the message to send
 */
Cypress.Commands.add('sendDirectMessageToUsers', (users, message) => {
    // # Open a new direct message
    cy.uiAddDirectMessage().click();

    users.forEach((user) => {
        // # Type username
        cy.get('#selectItems input').should('be.enabled').type(`@${user.username}`, {force: true});

        // * Expect user count in the list to be 1
        cy.get('#multiSelectList').
            should('be.visible').
            children().
            should('have.length', 1);

        // # Select first user in the list
        cy.get('body').
            type('{downArrow}').
            type('{enter}');
    });

    // # Click on "Go" in the group message's dialog to begin the conversation
    cy.get('#saveItems').click();

    // * Expect the channel title to be the user's username
    // In the channel header, it seems there is a space after the username, justifying the use of contains.text instead of have.text
    users.forEach((user) => {
        cy.get('#channelHeaderTitle').should('be.visible').and('contain.text', user.username);
    });

    // # Type message and send it to the user
    cy.get('#post_textbox').
        type(message).
        type('{enter}');
});

// ***********************************************************
// Post header
// ***********************************************************

function clickPostHeaderItem(postId, location, item) {
    let idPrefix;
    switch (location) {
    case 'CENTER':
        idPrefix = 'post';
        break;
    case 'RHS_ROOT':
    case 'RHS_COMMENT':
        idPrefix = 'rhsPost';
        break;
    case 'SEARCH':
        idPrefix = 'searchResult';
        break;

    default:
        idPrefix = 'post';
    }

    if (postId) {
        cy.get(`#${idPrefix}_${postId}`).trigger('mouseover', {force: true});
        cy.wait(TIMEOUTS.HALF_SEC).get(`#${location}_${item}_${postId}`).click({force: true});
    } else {
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#${idPrefix}_${lastPostId}`).trigger('mouseover', {force: true});
            cy.wait(TIMEOUTS.HALF_SEC).get(`#${location}_${item}_${lastPostId}`).click({force: true});
        });
    }
}

/**
 * Click post time
 * @param {String} postId - Post ID
 * @param {String} location - as 'CENTER', 'RHS_ROOT', 'RHS_COMMENT', 'SEARCH'
 */
Cypress.Commands.add('clickPostTime', (postId, location = 'CENTER') => {
    clickPostHeaderItem(postId, location, 'time');
});

/**
 * Click save icon by post ID or to most recent post (if post ID is not provided)
 * @param {String} postId - Post ID
 * @param {String} location - as 'CENTER', 'RHS_ROOT', 'RHS_COMMENT', 'SEARCH'
 */
Cypress.Commands.add('clickPostSaveIcon', (postId, location = 'CENTER') => {
    clickPostHeaderItem(postId, location, 'flagIcon');
});

/**
 * Click dot menu by post ID or to most recent post (if post ID is not provided)
 * @param {String} postId - Post ID
 * @param {String} location - as 'CENTER', 'RHS_ROOT', 'RHS_COMMENT', 'SEARCH'
 */
Cypress.Commands.add('clickPostDotMenu', (postId, location = 'CENTER') => {
    clickPostHeaderItem(postId, location, 'button');
});

/**
 * Click post reaction icon
 * @param {String} postId - Post ID
 * @param {String} location - as 'CENTER', 'RHS_ROOT', 'RHS_COMMENT'
 */
Cypress.Commands.add('clickPostReactionIcon', (postId, location = 'CENTER') => {
    clickPostHeaderItem(postId, location, 'reaction');
});

/**
 * Click comment icon by post ID or to most recent post (if post ID is not provided)
 * This open up the RHS
 * @param {String} postId - Post ID
 * @param {String} location - as 'CENTER', 'SEARCH'
 */
Cypress.Commands.add('clickPostCommentIcon', (postId, location = 'CENTER') => {
    clickPostHeaderItem(postId, location, 'commentIcon');
});

// ***********************************************************
// Teams
// ***********************************************************

Cypress.Commands.add('createNewTeam', (teamName, teamURL) => {
    cy.visit('/create_team');
    cy.get('#teamNameInput').type(teamName).type('{enter}');
    cy.get('#teamURLInput').type(teamURL).type('{enter}');
    cy.visit(`/${teamURL}`);
});

Cypress.Commands.add('getCurrentTeamURL', (siteURL) => {
    let path;

    // siteURL can be provided for cases where subpath is being tested
    if (siteURL) {
        path = window.location.href.substring(siteURL.length);
    } else {
        path = window.location.pathname;
    }

    const result = path.split('/', 2);
    return `/${(result[0] ? result[0] : result[1])}`; // sometimes the first element is emply if path starts with '/'
});

Cypress.Commands.add('leaveTeam', () => {
    // # Open team menu and click "Leave Team"
    cy.uiOpenTeamMenu('Leave Team');

    // * Check that the "leave team modal" opened up
    cy.get('#leaveTeamModal').should('be.visible');

    // # click on yes
    cy.get('#leaveTeamYes').click();

    // * Check that the "leave team modal" closed
    cy.get('#leaveTeamModal').should('not.exist');
});

// ***********************************************************
// Text Box
// ***********************************************************

Cypress.Commands.add('clearPostTextbox', (channelName = 'town-square') => {
    cy.get(`#sidebarItem_${channelName}`).click({force: true});
    cy.get('#post_textbox').clear();
});

// ***********************************************************
// Min Setting View
// ************************************************************

// Checking min setting view for display
Cypress.Commands.add('minDisplaySettings', () => {
    cy.get('#themeTitle').should('be.visible', 'contain', 'Theme');
    cy.get('#themeEdit').should('be.visible', 'contain', 'Edit');

    cy.get('#clockTitle').should('be.visible', 'contain', 'Clock Display');
    cy.get('#clockEdit').should('be.visible', 'contain', 'Edit');

    cy.get('#name_formatTitle').should('be.visible', 'contain', 'Teammate Name Display');
    cy.get('#name_formatEdit').should('be.visible', 'contain', 'Edit');

    cy.get('#collapseTitle').should('be.visible', 'contain', 'Default appearance of image previews');
    cy.get('#collapseEdit').should('be.visible', 'contain', 'Edit');

    cy.get('#message_displayTitle').scrollIntoView().should('be.visible', 'contain', 'Message Display');
    cy.get('#message_displayEdit').should('be.visible', 'contain', 'Edit');

    cy.get('#languagesTitle').scrollIntoView().should('be.visible', 'contain', 'Language');
    cy.get('#languagesEdit').should('be.visible', 'contain', 'Edit');
});

// ***********************************************************
// Change User Status
// ************************************************************

// Need to be in main channel view
// 0 = Online
// 1 = Away
// 2 = Do Not Disturb
// 3 = Offline
Cypress.Commands.add('userStatus', (statusInt) => {
    cy.get('.status-wrapper.status-selector').click();
    cy.get('.MenuItem').eq(statusInt).click();
});

// ***********************************************************
// Channel
// ************************************************************

Cypress.Commands.add('getCurrentChannelId', () => {
    return cy.get('#channel-header', {timeout: TIMEOUTS.HALF_MIN}).invoke('attr', 'data-channelid');
});

/**
 * Update channel header
 * @param {String} text - Text to set the header to
 */
Cypress.Commands.add('updateChannelHeader', (text) => {
    cy.get('#channelHeaderDropdownIcon').
        should('be.visible').
        click();
    cy.get('.Menu__content').
        should('be.visible').
        find('#channelEditHeader').
        click();
    cy.get('#edit_textbox').
        clear().
        type(text).
        type('{enter}').
        wait(TIMEOUTS.HALF_SEC);
});

/**
 * Navigate to system console-PluginManagement from account settings
 */
Cypress.Commands.add('checkRunLDAPSync', () => {
    cy.apiGetLDAPSync().then((response) => {
        var jobs = response.body;
        var currentTime = new Date();

        // # Run LDAP Sync if no job exists (or) last status is an error (or) last run time is more than 1 day old
        if (jobs.length === 0 || jobs[0].status === 'error' || ((currentTime - (new Date(jobs[0].last_activity_at))) > 8640000)) {
            // # Go to system admin LDAP page and run the group sync
            cy.visit('/admin_console/authentication/ldap');

            // # Click on AD/LDAP Synchronize Now button and verify if succesful
            cy.findByText('AD/LDAP Test').click();
            cy.findByText('AD/LDAP Test Successful').should('be.visible');

            // # Click on AD/LDAP Synchronize Now button
            cy.findByText('AD/LDAP Synchronize Now').click().wait(TIMEOUTS.ONE_SEC);

            // * Get the First row
            cy.findByTestId('jobTable').
                find('tbody > tr').
                eq(0).
                as('firstRow');

            // * Wait until first row updates to say Success
            cy.waitUntil(() => {
                return cy.get('@firstRow').then((el) => {
                    return el.find('.status-icon-success').length > 0;
                });
            }
            , {
                timeout: TIMEOUTS.FIVE_MIN,
                interval: TIMEOUTS.TWO_SEC,
                errorMsg: 'AD/LDAP Sync Job did not finish',
            });
        }
    });
});

/**
 * Clicks on a visible emoji in the emoji picker.
 * For emojis further down the page, search for that emoji in search bar and then use this command to click on it.
 * @param {String} emojiName - The name of emoji to click. For emojis with multiple names concat with ','
 * @returns null
 */
Cypress.Commands.add('clickEmojiInEmojiPicker', (emojiName) => {
    cy.get('#emojiPicker').should('exist').and('be.visible').within(() => {
        // # Mouse over the emoji to get it selected
        cy.findByTestId(emojiName).trigger('mouseover', {force: true});

        // * Verify that preview shows the emoji selected
        cy.findByTestId('emoji_picker_preview').should('exist').and('be.visible').contains(emojiName, {matchCase: false});

        // # Click on the emoji
        cy.findByTestId(emojiName).click({force: true});
    });
});
