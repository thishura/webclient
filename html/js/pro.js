/**
 * Common functionality for both the Pro pages (Step 1 and Step 2). Some functions e.g.
 * getProPlanName() and getPaymentGatewayName() may be used from other places not just the Pro pages.
 */
var pro = {

    /** An array of the possible membership plans from the API */
    membershipPlans: [],
    conversionRate: 0,

    lastLoginStatus: -99, // a var to store the user login status when prices feteched

    /** The last payment provider ID used */
    lastPaymentProviderId: null,

    /* Constants for the array indexes of the membership plans (these are from the API 'utqa' response) */
    UTQA_RES_INDEX_ID: 0,
    UTQA_RES_INDEX_ACCOUNTLEVEL: 1,
    UTQA_RES_INDEX_STORAGE: 2,
    UTQA_RES_INDEX_TRANSFER: 3,
    UTQA_RES_INDEX_MONTHS: 4,
    UTQA_RES_INDEX_PRICE: 5,
    UTQA_RES_INDEX_CURRENCY: 6,
    UTQA_RES_INDEX_MONTHLYBASEPRICE: 7,
    UTQA_RES_INDEX_LOCALPRICE: 8,
    UTQA_RES_INDEX_LOCALPRICECURRENCY: 9,
    UTQA_RES_INDEX_LOCALPRICECURRENCYSAVE: 10,
    UTQA_RES_INDEX_ITEMNUM: 11,

    /* Constants for special Pro levels */
    ACCOUNT_LEVEL_STARTER: 11,
    ACCOUNT_LEVEL_BASIC: 12,
    ACCOUNT_LEVEL_ESSENTIAL: 13,
    ACCOUNT_LEVEL_PRO_LITE: 4,
    ACCOUNT_LEVEL_PRO_I: 1,
    ACCOUNT_LEVEL_PRO_II: 2,
    ACCOUNT_LEVEL_PRO_III: 3,
    ACCOUNT_LEVEL_PRO_FLEXI: 101,
    ACCOUNT_LEVEL_BUSINESS: 100,

    /* Account statuses for Business and Pro Flexi accounts */
    ACCOUNT_STATUS_EXPIRED: -1,
    ACCOUNT_STATUS_ENABLED: 1,
    ACCOUNT_STATUS_GRACE_PERIOD: 2,

    /* Number of bytes for conversion, as we recieve GB for plans, and use bytes for sizing */
    BYTES_PER_GB: 1024 * 1024 * 1024,
    BYTES_PER_TB: 1024 * 1024 * 1024 * 1024,

    /**
     * Determines if a Business or Pro Flexi account is expired or in grace period
     * @param {Number} accountStatus The account status e.g. from u_attr.b.s (Business) or u_attr.pf.s (Pro Flexi)
     * @returns {Boolean} Returns true if the account is expired or in grace period
     */
    isExpiredOrInGracePeriod: function(accountStatus) {
        'use strict';

        return [this.ACCOUNT_STATUS_EXPIRED, this.ACCOUNT_STATUS_GRACE_PERIOD].includes(accountStatus);
    },

    /**
     * Load pricing plan information from the API. The data will be loaded into 'pro.membershipPlans'.
     * @param {Function} loadedCallback The function to call when the data is loaded
     */
    loadMembershipPlans: async function(loadedCallback) {
        "use strict";

        // Set default
        loadedCallback = loadedCallback || function() { };

        // If this data has already been fetched, re-use it and run the callback function
        if (pro.membershipPlans.length > 0 && !(!pro.lastLoginStatus && u_type > 0)) {
            loadedCallback();
        }
        else {
            // Get the membership plans.
            const payload = {a: 'utqa', nf: 2, p: 1};

            await api.req({a: 'uq', pro: 1, gc: 1})
                .then(({result: {balance}}) => {
                    if (balance) {
                        balance = balance.length && parseFloat(balance[0][0]);

                        if (balance >= 4.99 && balance <= 9.98) {
                            payload.r = 1;
                        }
                    }
                })
                .catch(dump);

            api.req(payload)
                .then(({result: results}) => {

                    // The rest of the webclient expects this data in an array format
                    // [api_id, account_level, storage, transfer, months, price, currency, monthlybaseprice]
                    var plans = [];
                    var maxPlan = null;
                    var minPlan = null;
                    var lmbps = {};
                    const allowLocal = localStorage.blockLocal !== '1';
                    const blockedPlans = localStorage.blockPlans && localStorage.blockPlans.split(',');

                    const conversionRate = results[0].l.lc === "EUR" ? 1 : results[0].l.exch;

                    for (var i = 1; i < results.length; i++) {

                        let discount = 0;

                        if (blockedPlans && blockedPlans.includes(String(results[i].al))) {
                            continue;
                        }

                        if (results[i].m === 1) {
                            lmbps[results[i].mbp] = results[i].lp;
                        }
                        else {
                            discount = lmbps[results[i].mbp] * results[i].m - results[i].lp;
                        }

                        // If this is Pro Flexi, the data is structured similarly to business, so set that manually
                        if (results[i].al === pro.ACCOUNT_LEVEL_PRO_FLEXI) {
                            plans.push([
                                results[i].id,              // id
                                results[i].al,              // account level
                                results[i].bd.ba.s,         // base storage
                                results[i].bd.ba.t,         // base transfer
                                results[i].m,               // months
                                results[i].bd.ba.p  / 100,  // base price
                                results[0].l.c,             // currency
                                results[i].bd.ba.p  / 100,  // monthly base price
                                results[i].bd.ba.lp / 100,  // local base price
                                results[0].l.lc,            // local price currency
                                0,                          // local price save
                                results[i].it,              // item (will be 1 for business / Pro Flexi)
                                results[i].bd.sto.p / 100,  // extra storage rate
                                results[i].bd.sto.lp / 100, // extra storage local rate
                                results[i].bd.trns.p / 100,  // extra transfer rate
                                results[i].bd.trns.lp / 100  // extra transfer local rate
                            ]);
                        }
                        else {
                            // Otherwise for PRO I - III and PRO Lite set as so
                            plans.push([
                                results[i].id,          // id
                                results[i].al,          // account level
                                results[i].s,           // storage
                                results[i].t,           // transfer
                                results[i].m,           // months
                                results[i].p / 100,     // price
                                results[0].l.c,         // currency
                                results[i].mbp / 100,   // monthly base price
                                (allowLocal && results[i].lp / 100),    // local price
                                (allowLocal && results[0].l.lc),        // local price currency
                                (allowLocal && discount / 100),         // local price save
                                results[i].it           // item (will be 0 for user)
                            ]);
                        }
                        pro.planObjects.createPlanObject(plans[plans.length - 1]);
                        if (results[i].m === 1 && results[i].it !== 1) {
                            if (!maxPlan || maxPlan[2] < results[i]['s']) {
                                maxPlan = plans[plans.length - 1];
                            }
                            if (!minPlan || minPlan[2] > results[i]['s']) {
                                minPlan = plans[plans.length - 1];
                            }
                        }
                    }

                    // Store globally
                    pro.membershipPlans = plans;
                    pro.lastLoginStatus = u_type;
                    pro.maxPlan = maxPlan;
                    pro.minPlan = minPlan;
                    pro.conversionRate = conversionRate;
                })
                .finally(() => {
                    pro.initFilteredPlans();
                    // Run the callback function
                    loadedCallback();
                });
        }
    },

    /**
     * Redirect to the site.
     * @param {String} topage Redirect to this page of our site.
     */
    redirectToSite: function(topage) {
        'use strict';

        // On mobile just load the main account page as there is no payment history yet
        topage = topage || (is_mobile ? 'fm/account' : 'fm/account/plan');

        // Make sure it fetches new account data on reload
        // and redirect to account page to show purchase
        if (M.account) {
            M.account.lastupdate = 0;

            // If pro page is opened from account/plan update M.currentdirid to force call openfolder
            M.currentdirid = String(M.currentdirid).substr(0, 7) === 'account' ? false : M.currentdirid;
        }

        loadSubPage(topage);
    },

    /**
     * Show the payment result of success or failure after coming back from a provider
     * @param {String} verifyUrlParam The URL parameter e.g. 'success' or 'failure'
     */
    showPaymentResult: function(verifyUrlParam) {
        'use strict';

        var $backgroundOverlay = $('.fm-dialog-overlay');
        var $pendingOverlay = $('.payment-result.pending.alternate');
        var $failureOverlay = $('.payment-result.failed');

        // Show the overlay
        $backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');

        // On successful payment
        if (verifyUrlParam === 'success') {

            // Show the success
            $pendingOverlay.removeClass('hidden');

            insertEmailToPayResult($pendingOverlay);

            if (!u_type || u_type !== 3) {
                $pendingOverlay.find('.payment-result-button, .payment-close').addClass('hidden');
            }
            else {
                $pendingOverlay.find('.payment-result-button, .payment-close').removeClass('hidden');

                // Add click handlers for 'Go to my account' and Close buttons
                $pendingOverlay.find('.payment-result-button, .payment-close').rebind('click', function () {

                    // Hide the overlay
                    $backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
                    $pendingOverlay.addClass('hidden');

                    pro.redirectToSite();
                });
            }
        }
        else {
            // Show the failure overlay
            $failureOverlay.removeClass('hidden');

            // On click of the 'Try again' or Close buttons, hide the overlay
            $failureOverlay.find('.payment-result-button, .payment-close').rebind('click', function() {

                // Hide the overlay
                $backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
                $failureOverlay.addClass('hidden');
                if (u_attr && u_attr.b) {
                    loadSubPage('registerb');
                }
                else {
                    loadSubPage('pro');
                }
            });
        }
    },

    /**
    * Update the state when a payment has been received to show their new Pro Level
    * @param {Object} actionPacket The action packet {'a':'psts', 'p':<prolevel>, 'r':<s for success or f for failure>}
    */
    processPaymentReceived: function (actionPacket) {

        // Check success or failure
        var success = (actionPacket.r === 's') ? true : false;

        // Add a notification in the top bar
        notify.notifyFromActionPacket(actionPacket);

        // If their payment was successful, redirect to account page to show new Pro Plan
        if (success) {

            // Make sure it fetches new account data on reload
            if (M.account) {
                M.account.lastupdate = 0;
            }

            // Don't show the plan expiry dialog anymore for this session
            alarm.planExpired.lastPayment = null;

            // If last payment was Bitcoin, we need to redirect to the account page
            if (pro.lastPaymentProviderId === bitcoinDialog.gatewayId) {
                loadSubPage('fm/account/plan');
            }
        }
    },

    /**
     * Get a string for the payment plan number
     * @param {Number} planNum The plan number e.g. 1, 2, 3, 4, 100, 101, undefined
     * @returns {String} The plan name i.e. Pro I, Pro II, Pro III, Pro Lite, Business, Pro Flexi, Free (default)
     */
    getProPlanName: function(planNum) {

        switch (planNum) {
            case 1:
                return l[5819];                 // Pro I
            case 2:
                return l[6125];                 // Pro II
            case 3:
                return l[6126];                 // Pro III
            case 4:
                return l[8413];                 // Pro Lite
            case 11:
                return l.plan_name_starter;     // Starter
            case 12:
                return l.plan_name_basic;       // Basic
            case 13:
                return l.plan_name_essential;   // Essential
            case 100:
                return l[19530];                // Business
            case 101:
                return l.pro_flexi_name;        // Pro Flexi
            default:
                return l[1150];                 // Free
        }
    },

    /**
     * Returns the name of the gateway / payment provider and display name. The API will only
     * return the gateway ID which is unique on the API and will not change.
     *
     * @param {Number} gatewayId The number of the gateway/provider from the API
     * @returns {Object} Returns an object with two keys, the 'name' which is a unique string
     *                   for the provider which can be used for displaying icons etc, and the
     *                   'displayName' which is the translated name for that provider (however
     *                   company names are not translated).
     */
    getPaymentGatewayName: function(gatewayId, gatewayOpt) {

        var gateways = {
            0: {
                name: 'voucher',
                displayName: l[487]     // Voucher code
            },
            1: {
                name: 'paypal',
                displayName: l[1233]    // PayPal
            },
            2: {
                name: 'apple',
                displayName: 'Apple'
            },
            3: {
                name: 'google',
                displayName: 'Google'
            },
            4: {
                name: 'bitcoin',
                displayName: l[6802]    // Bitcoin
            },
            5: {
                name: 'dynamicpay',
                displayName: l[7109]    // UnionPay
            },
            6: {
                name: 'fortumo',
                displayName: l[7219] + ' (' + l[7110] + ')'    // Mobile (Fortumo)
            },
            7: {
                name: 'stripe',
                displayName: l[7111]    // Credit Card
            },
            8: {
                name: 'perfunctio',
                displayName: l[7111]    // Credit Card
            },
            9: {
                name: 'infobip',
                displayName: l[7219] + ' (Centilli)'    // Mobile (Centilli)
            },
            10: {
                name: 'paysafecard',
                displayName: 'paysafecard'
            },
            11: {
                name: 'astropay',
                displayName: 'AstroPay'
            },
            12: {
                name: 'reserved',
                displayName: 'reserved' // TBD
            },
            13: {
                name: 'windowsphone',
                displayName: l[8660]    // Windows Phone
            },
            14: {
                name: 'tpay',
                displayName: l[7219] + ' (T-Pay)'       // Mobile (T-Pay)
            },
            15: {
                name: 'directreseller',
                displayName: l[6952]    // Credit card
            },
            16: {
                name: 'ecp',                    // E-Comprocessing
                displayName: l[6952] + ' (ECP)' // Credit card (ECP)
            },
            17: {
                name: 'sabadell',
                displayName: 'Sabadell'
            },
            19: {
                name: 'Stripe2',
                displayName: l[6952] + ' (Stripe)' // Credit card (Stripe)
            },
            999: {
                name: 'wiretransfer',
                displayName: l[6198]    // Wire transfer
            }
        };

        // If the gateway option information was provided we can improve the default naming in some cases
        if (typeof gatewayOpt !== 'undefined') {
            if (typeof gateways[gatewayId] !== 'undefined') {
                // Subgateways should always take their subgateway name from the API if provided
                gateways[gatewayId].name =
                    (gatewayOpt.type === 'subgateway') ? gatewayOpt.gatewayName : gateways[gatewayId].name;

                // Direct reseller still requires the translation from above to be in its name
                if (gatewayId === 15 && gatewayOpt.type !== 'subgateway') {
                    gateways[gatewayId].displayName = gateways[gatewayId].displayName + " " + gatewayOpt.displayName;
                }
                else {
                    gateways[gatewayId].displayName =
                        (gatewayOpt.type === 'subgateway') ? gatewayOpt.displayName : gateways[gatewayId].displayName;
                }

                // If in development and on staging, add some extra info for seeing which provider E.g. ECP/Sabadell/AP
                // mega.flags.bid can be passed from API to ask us to turn on "extra info" showing for providers.
                if (d && (apipath === 'https://staging.api.mega.co.nz/' || mega.flags.bid)) {
                    gateways[gatewayId].displayName += ' (via ' + gateways[gatewayId].name + ')';
                }
            }
        }

        // If the gateway exists, return it
        if (typeof gateways[gatewayId] !== 'undefined') {
            return gateways[gatewayId];
        }

        // Otherwise return a placeholder for currently unknown ones
        return {
            name: 'unknown',
            displayName: 'Unknown'
        };
    },

    /**
     * Returns the event ID for the payment method.
     *
     * @param {String} gatewayCode The code of the gateway/provider from the API
     * @returns {Number} the event ID to log clicks against.
     */
    getPaymentEventId: (gatewayCode) => {
        'use strict';

        switch (gatewayCode) {
            case 'ecpVI': // Visa - ECP
            case 'stripeVI': // Visa - Stripe
                return 500359;
            case 'ecpMC': // Mastercard - ECP
            case 'stripeMC': // Mastercard - Stripe
                return 500360;
            case 'stripeAE': // American Express - Stripe
                return 500361;
            case 'stripeJC': // JCB - Stripe
                return 500362;
            case 'stripeUP': // China UnionPay - Stripe
                return 500363;
            case 'Stripe': // Stripe
                return 500364;
            case 'bitcoin': // Bitcoin
                return 500365;
            case 'voucher': // Voucher code
                return 500366;
            default: // return 500374 if a particular gateway isn't tied to an event ID
                return 500374;
        }
    },

    /**
     * Update the pro page depending on if the user can see the "exclusive offer" tab
     * (mini plans) or not.
     *
     * If they can, fill in the empty low tier plan feature table cells (plan title and
     * storage and transfer quotas).
     *
     * Otherwise, delete the low tier plans flag, hide the "exclusive offer" tab and
     * show the user a dialog/sheet.
     *
     * @param {Boolean} canSeeMiniPlans
     * @returns {void}
     */
    updateLowTierProPage(canSeeMiniPlans) {
        'use strict';

        if (canSeeMiniPlans) {
            pro.proplan2.updateExcOffers();
        }
        else {
            const showProPlansTab = () => {
                delete window.mProTab;

                $('.tabs-module-block#pr-exc-offer-tab', '.individual-team-tab-container').addClass('hidden');
                $('.tabs-module-block#pr-individual-tab', '.individual-team-tab-container').trigger('click');
            };

            if (is_mobile) {
                mega.ui.sheet.show({
                    name: 'cannot-view-offer',
                    type: 'modal',
                    showClose: false,
                    preventBgClosing: true,
                    contents: l.cannot_view_offer,
                    actions: [
                        {
                            type: 'normal',
                            text: l[81], // OK
                            onClick: () => {
                                mega.ui.sheet.hide();
                                showProPlansTab();
                            }
                        }
                    ]
                });
            }
            else {
                const cannotViewOfferDialog = new mega.ui.Dialog({
                    'className': 'cannotviewoffer-dialog',
                    'closable': false,
                    'closableByOverlay': false,
                    'focusable': false,
                    'expandable': false,
                    'requiresOverlay': true,
                    'buttons': []
                });
                cannotViewOfferDialog.rebind('onBeforeShow', function() {
                    $('header p', this.$dialog).text(l.cannot_view_offer);

                    $('button.ok-close', this.$dialog).rebind('click.closeDialog', () => {
                        cannotViewOfferDialog.hide();
                        showProPlansTab();
                    });
                });

                cannotViewOfferDialog.show();
            }
        }
    },

    // These are indented to this level to keep the pro object cleaner, and they should not be directly accessed outside
    // of functions in pro. pro.getPlanObj should be used to retreive them instead.
    planObjects: {
        planKeys: Object.create(null),
        planTypes: Object.create(null),

        createPlanObject(plan) {
            'use strict';
            const key = plan[pro.UTQA_RES_INDEX_ID] + plan[pro.UTQA_RES_INDEX_ITEMNUM];

            lazy(pro.planObjects.planKeys, key, () => {

                const thisPlan = {
                    key,        // Plan key
                    _saveUpTo: null,        // Stores the saveUpTo percentage of the plan, in case given by another plan
                    _correlatedPlan: null,       // Stores the correlated plan, in case given by another plan
                    _maxCorrPriceEur: null,
                    planArray: plan,
                };

                lazy(thisPlan, 'id', () => plan[pro.UTQA_RES_INDEX_ID]);
                lazy(thisPlan, 'itemNum', () => plan[pro.UTQA_RES_INDEX_ITEMNUM]);
                lazy(thisPlan, 'level', () => plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL]);
                lazy(thisPlan, 'name', () => pro.getProPlanName(plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL]));
                lazy(thisPlan, 'storage', () => plan[pro.UTQA_RES_INDEX_STORAGE] * pro.BYTES_PER_GB);
                lazy(thisPlan, 'transfer', () => plan[pro.UTQA_RES_INDEX_TRANSFER] * pro.BYTES_PER_GB);
                lazy(thisPlan, 'months', () => plan[pro.UTQA_RES_INDEX_MONTHS]);
                lazy(thisPlan, 'price', () => plan[pro.UTQA_RES_INDEX_LOCALPRICE] || plan[pro.UTQA_RES_INDEX_PRICE]);
                lazy(thisPlan, 'currency', () => {
                    return plan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY] || plan[pro.UTQA_RES_INDEX_CURRENCY];
                });
                lazy(thisPlan, 'priceEuro', () => plan[pro.UTQA_RES_INDEX_PRICE]);
                lazy(thisPlan, 'currencyEuro', () => plan[pro.UTQA_RES_INDEX_CURRENCY]);
                lazy(thisPlan, 'save', () => plan[pro.UTQA_RES_INDEX_LOCALPRICESAVE] || false);
                lazy(thisPlan, 'monthlyBasePrice', () => plan[pro.UTQA_RES_INDEX_MONTHLYBASEPRICE] || false);
                lazy(thisPlan, 'hasLocal', () => !!plan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY]);

                lazy(thisPlan, 'correlatedPlan', () => {
                    if (thisPlan._correlatedPlan === null) {
                        let correlatedPlan = false;
                        const arrCorrPlan = pro.membershipPlans.find((searchPlan) => {
                            return ((searchPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] === thisPlan.level)
                                && (searchPlan[pro.UTQA_RES_INDEX_MONTHS] !== thisPlan.months));
                        });
                        if (arrCorrPlan) {
                            const planObj = pro.getPlanObj(arrCorrPlan);
                            planObj._correlatedPlan = thisPlan;
                            correlatedPlan = planObj;
                        }
                        thisPlan._correlatedPlan = correlatedPlan;
                    }
                    return thisPlan._correlatedPlan;
                });

                lazy(thisPlan, 'saveUpTo', () => {
                    if (thisPlan._saveUpTo === null) {
                        let saveUpTo = false;
                        if (thisPlan.correlatedPlan) {
                            const thisMonthlyPrice = thisPlan.price / thisPlan.months;
                            const corrMonthlyPrice = thisPlan.correlatedPlan.price / thisPlan.correlatedPlan.months;
                            saveUpTo = percentageDiff(thisMonthlyPrice, corrMonthlyPrice, 3);
                            thisPlan.correlatedPlan._saveUpTo = saveUpTo;
                        }
                        thisPlan._saveUpTo = saveUpTo;
                    }
                    return thisPlan._saveUpTo;
                });

                lazy(thisPlan, 'maxCorrPriceEuro', () => {
                    if (thisPlan._maxCorrPriceEur === null) {
                        let maxCorrPrice = thisPlan.priceEuro;
                        if (thisPlan.correlatedPlan) {
                            maxCorrPrice = Math.max(thisPlan.priceEuro, thisPlan.correlatedPlan.priceEuro);
                            thisPlan.correlatedPlan._maxCorrPriceEur = maxCorrPrice;
                        }
                        thisPlan._maxCorrPrice = maxCorrPrice;
                    }
                    return thisPlan._maxCorrPrice;
                });

                lazy(thisPlan, 'yearlyDiscount', () => {
                    if (thisPlan.save) {
                        return thisPlan.save;
                    }
                    if ((thisPlan.months === 1) || !thisPlan.correlatedPlan) {
                        return false;
                    }
                    const baseYearly = thisPlan.correlatedPlan.price * 12;

                    // Multiply by 100 and then divide by 100 to avoid floating point issues as JS hates decimals
                    return (baseYearly * 100 - thisPlan.price * 100) / 100;
                });

                /**
                 * Checks if the plan is in a filter, returns boolean or level of the plan in the filter.
                 * @param {string} filter - The name of the filter to check
                 * @param {?string} returnType - Desired return type. Will return boolean if not specified.
                 * @returns {number | boolean} - Returns if the plan is in the filter,
                 * as the level of the plan if specified, or as a boolean if not.
                 */
                thisPlan.isIn = (filter, returnType) => {
                    if (returnType === 'asLevel') {
                        return pro.filter.simple[filter].has(thisPlan.level) ? thisPlan.level : 0;
                    }
                    return pro.filter.simple[filter].has(thisPlan.level);
                };

                return thisPlan;

            });
        },
    },

    initFilteredPlans() {
        'use strict';
        const pf = pro.filter;
        const superFilterKeys = Object.keys(pf.superSet);

        for (let i = 0; i < superFilterKeys.length; i++) {
            const key = superFilterKeys[i];
            const subsets = pf.superSet[key];
            let allItems = [];

            for (let j = 0; j < subsets.length; j++) {
                allItems = ([...allItems, ...pf.simple[subsets[j]]]);
            }

            pf.simple[superFilterKeys[i]] = new Set(allItems);
        }

        const simpleFilterKeys = Object.keys(pf.simple);
        const invertedFilterKeys = Object.keys(pf.inverted);

        // If a non-simple filter has already been used, it will also already be in simple filters
        const setUp = new Set();

        // For monthly (1), yearly (12), and combined (23)
        for (let i = 1; i < 24; i += 11) {
            const months = i < 13 ? i : false;
            const monthsTag = months
                ? months === 1 ? 'M' : 'Y'
                : '';


            for (let j = 0; j < simpleFilterKeys.length; j++) {
                setUp.add(simpleFilterKeys[j] + monthsTag);

                // Set up basic plan sub-arrays (is in account level group, and right num months)
                lazy(pf.plans, simpleFilterKeys[j] + monthsTag, () => pro.membershipPlans.filter((plan) => {
                    if (months) {
                        return pro.filter.simple[simpleFilterKeys[j]].has(plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL])
                            && plan[pro.UTQA_RES_INDEX_MONTHS] === months;
                    }
                    return pro.filter.simple[simpleFilterKeys[j]].has(plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL]);
                }));
            }

            for (let j = 0; j < invertedFilterKeys.length; j++) {
                if (setUp.has(invertedFilterKeys[j] + monthsTag)) {
                    continue;
                }
                setUp.add(invertedFilterKeys[j] + monthsTag);

                // Set up inverted plan sub-arrays (is in all minus specified, correct num months(via allX))
                lazy(pf.plans, invertedFilterKeys[j] + monthsTag, () =>
                    pro.filter.plans[`all${monthsTag}`].filter((plan) =>
                        pro.filter.simple[invertedFilterKeys[j]].has(plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL])
                    )
                );
            }

        }

        lazy(pro.filter, 'affMin', () => {
            const plans = pro.filter.plans.affPlans;
            let currentMin = plans[0];
            for (let i = 1; i < plans.length; i++) {
                if (plans[i][pro.UTQA_RES_INDEX_STORAGE] < currentMin[pro.UTQA_RES_INDEX_STORAGE]) {
                    currentMin = plans[i];
                }
            }
            return currentMin;
        });

        lazy(pro.filter, 'miniMin', () => {
            const plans = pro.filter.plans.miniPlans;
            if (!plans.length) {
                return false;
            }
            let currentMin = plans[0];
            for (let i = 1; i < plans.length; i++) {
                if (plans[i][pro.UTQA_RES_INDEX_STORAGE] < currentMin[pro.UTQA_RES_INDEX_STORAGE]) {
                    currentMin = plans[i];
                }
            }
            return currentMin;
        });
    },

    /**
     * Given a plan array, a plan key (id + itemnum), or the account level/number of months, returns objectified plan
     * @param {Array | number} plan - takes in the full plan array, or the account level
     * @param {number | string} [months = 1] - the number of months of the plan if account level is given
     * @returns {Object | boolean} - returns the same plan but as an object, or false if none found
     */
    getPlanObj(plan, months) {
        'use strict';
        const {planTypes} = pro.planObjects;
        months = (months |= 0) || 1;
        let key;
        let type;
        if (typeof plan === 'number' || typeof plan === 'string') {
            type = plan + '_' + months;
            if (planTypes[type]) {
                return planTypes[type];
            }
            plan = pro.membershipPlans.find((searchPlan) => {
                return ((searchPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] === +plan)
                    && (searchPlan[pro.UTQA_RES_INDEX_MONTHS] === months));
            });
        }

        if (typeof plan === 'object') {
            key = plan[pro.UTQA_RES_INDEX_ID] + plan[pro.UTQA_RES_INDEX_ITEMNUM];
        }
        // If plan level and duration given, cache it as may be used again
        if (type) {
            planTypes[type] = pro.planObjects.planKeys[key];
        }
        return pro.planObjects.planKeys[key] || false;
    },

    /**
     * When it is unknown what type we will receive for a plan, this function will always return the plan level as num
     * @param {Array | Object | string | number} plan - The plan or plan level to return the plan level of
     * @returns {number} - the plan level number
     */
    getPlanLevel(plan) {
        'use strict';
        if (typeof plan === 'number') {
            return plan;
        }
        else if (Array.isArray(plan)) {
            plan = plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];
        }
        else if (typeof plan === 'object') {
            plan = plan.level;
        }
        return plan | 0;
    },

    /**
     * Checks if the given plan/plan level is in the given filter
     * @param {Array | Object | string | number} plan
     * @param {string} [filter = 'all'] filter - the filter to check the plan against
     * @returns {boolean} - If the plan is in the filter
     */
    planInFilter(plan, filter) {
        'use strict';
        const filterSet = pro.filter.simple[filter || 'all'];
        if (!filterSet) {
            if (d) {
                console.error('Invalid filter: ' + filter);
            }
            return false;
        }
        return filterSet.has(pro.getPlanLevel(plan));
    }
};

/**
 * Contains the filtering functions, filter types, and plans
 * @property pro.filter
 */
lazy(pro, 'filter', () => {
    'use strict';
    const pf = {

        // contains the filtered plan arrays
        plans: Object.create(null),

        // These are intended to be used in a similar way to transifex strings
        // If 2 arrays are the same but have a different context, please keep them separate.
        // This is to make future updating as straightforward as possible.
        simple: {

            // validPurchases: 11, 12, 13, 4, 1, 2, 3, 101 - plans that are valid to purchase via propay_X
            // Excludes any plans that are not directly purchasable at the url /propay_X. e.g., Business
            validPurchases:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_LITE, pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II,
                    pro.ACCOUNT_LEVEL_PRO_III, pro.ACCOUNT_LEVEL_PRO_FLEXI
                ]),

            // all: 11, 12, 13, 4, 1, 2, 3, 101, 100 - all currently available plans
            // Excludes any plans that the webclient is not yet ready to support.
            all:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_LITE, pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II,
                    pro.ACCOUNT_LEVEL_PRO_III, pro.ACCOUNT_LEVEL_PRO_FLEXI, pro.ACCOUNT_LEVEL_BUSINESS
                ]),

            // storageTransferDialogs: 11, 12, 13, 4, 1, 2, 3, 101 - plans that should be shown in the storage
            // and transfer upsell dialogs
            storageTransferDialogs:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_LITE, pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II,
                    pro.ACCOUNT_LEVEL_PRO_III, pro.ACCOUNT_LEVEL_PRO_FLEXI
                ]),

            // lowStorageQuotaPlans: 11, 12, 13, 4 - plans that should have their monthly price shown
            // in the storage upsell dialogs
            lowStorageQuotaPlans:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_LITE
                ]),

            // affPlans: 4, 1, 2, 3 - plans that can show in the affiliate redeem section
            affPlans:
                new Set([
                    pro.ACCOUNT_LEVEL_PRO_LITE, pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II,
                    pro.ACCOUNT_LEVEL_PRO_III
                ]),

            // miniPlans: 11, 12, 13 - mini plans available to targeted users
            miniPlans:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL
                ]),

            // ninetyDayRewind: 11, 12, 13, 4 - plans that have up to 90 days rewind instead of up to 180 days
            ninetyDayRewind:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_LITE
                ]),

            // proPlans: 4, 1, 2, 3, 101 - plans that are in the group "pro"
            proPlans:
                new Set([
                    pro.ACCOUNT_LEVEL_PRO_LITE, pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II,
                    pro.ACCOUNT_LEVEL_PRO_III, pro.ACCOUNT_LEVEL_PRO_FLEXI
                ]),

            // core 4, 1, 2, 3 - plans with a set amount of storage and transfer and are available to most or all users
            core:
                new Set([
                    pro.ACCOUNT_LEVEL_PRO_LITE, pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II,
                    pro.ACCOUNT_LEVEL_PRO_III
                ]),

            // recommend: 1, 2, 3 - plans that are able to be recommended to users
            recommend:
                new Set([
                    pro.ACCOUNT_LEVEL_PRO_I, pro.ACCOUNT_LEVEL_PRO_II, pro.ACCOUNT_LEVEL_PRO_III
                ]),

            // TODO: Make this dynamic instead of hardcoding the values. Cannot guarantee no changes in the future.
            // yearlyMiniPlans: 12, 13 - mini plans available to targeted users which allow yearly subscriptions
            yearlyMiniPlans:
                new Set([
                    pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL
                ])
        },

        // Sets of plans to invert (all plans minus specified plans), will then
        // be added to pro.filter.simple, and plan arrays added to pro.filter.plans
        inverted: {
            // Plans that do not see the cancel benefits dialog
            canSeeCancelBenefits:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_FLEXI, pro.ACCOUNT_LEVEL_BUSINESS
                ]),

            // Plans that do not have an icon to show
            hasIcon:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL
                ]),

            supportsExpensive:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_LITE
                ]),

            supportsGooglePlay:
                new Set([
                    pro.ACCOUNT_LEVEL_STARTER, pro.ACCOUNT_LEVEL_BASIC, pro.ACCOUNT_LEVEL_ESSENTIAL,
                    pro.ACCOUNT_LEVEL_PRO_FLEXI
                ]),
        },

        superSet: {
            // Plans that are exlusive offiers
            excPlans: ['miniPlans'],

            // Plans that have regular transfer and storage quota
            regular: ['miniPlans', 'core'],
        },

        /**
         * Finds the lowest monthly plan that can store the users data, excluding their current plan
         * @param {number} userStorage - The users current storage in bytes
         * @param {string} secondaryFilter - The subset of plans to choose lowest plan from
         * @returns {Array|false} - An array item of the specific plan, or false if no plans found
         */
        lowestRequired(userStorage, secondaryFilter = 'all') {
            const plans = pro.filter.plans[secondaryFilter + 'M'];
            if (!plans) {
                console.assert(pro.membershipPlans.length, 'Plans not loaded');
                return;
            }
            return plans.find((plan) =>
                (plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] !== u_attr.p)
                && ((plan[pro.UTQA_RES_INDEX_STORAGE] * pro.BYTES_PER_GB) > userStorage)
                || (plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] === pro.ACCOUNT_LEVEL_PRO_FLEXI));
        }

    };

    const invertedFilterKeys = Object.keys(pf.inverted);

    for (let j = 0; j < invertedFilterKeys.length; j++) {

        lazy(pf.simple, invertedFilterKeys[j], () => {

            return new Set([...pro.filter.simple.all].filter((id) =>
                !pro.filter.inverted[invertedFilterKeys[j]].has(id)
            ));
        });
    }

    return Object.setPrototypeOf(pf, null);
});
