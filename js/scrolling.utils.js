/**
 * initPerfectScrollbar
 * @param {Object} $scrollBlock DOM scrollable element.
 * @returns {void}
 */
function initPerfectScrollbar($scrollBlock) {

    'use strict';

    if (!$scrollBlock || !$scrollBlock.length) {
        return false;
    }

    for (let i = 0; i < $scrollBlock.length; i++) {

        if ($scrollBlock[i].classList.contains('ps')) {
            Ps.update($scrollBlock[i]);
        }
        else {
            Ps.initialize($scrollBlock[i]);
        }
    }
}

/**
 * initTextareaScrolling
 * @param {Object} $textarea DOM textarea element.
 * @returns {void}
 */
function initTextareaScrolling($textarea) {

    'use strict';

    const $scrollBlock = $textarea.closest('.textarea-scroll') || $textarea.parent();
    let $preview = $('.textarea-clone', $scrollBlock);

    if ($preview.length === 0) {
        $preview = $('<div class="textarea-clone"></div>');
        $scrollBlock.append($preview);
    }

    const updateScroll = () => {

        $preview.safeHTML(`${$textarea.val().replace(/\n/g, '<br />')} <br>`);
        $textarea.height($preview.height());
        initPerfectScrollbar($scrollBlock);
    };

    updateScroll();

    $textarea.rebind('input.updateScroll change.updateScroll', () => {
        updateScroll();
    });
}


/**
 * Scroll to an element if it's not visible in DOM
 * @param {Object} $scrollBlock DOM scrollable element.
 * @param {Object} $scrollTo DOM target element.
 * @returns {void}
 */
function scrollToElement($scrollBlock, $scrollTo) {

    'use strict';

    if ($scrollTo.length && $scrollBlock.length) {

        const scrollToOffset = $scrollTo.offset().top;
        const scrollToHeight = $scrollTo.hasClass('expanded')
            ? $scrollTo.parent().outerHeight() : $scrollTo.outerHeight();
        const scrollBlockOffset = $scrollBlock.offset().top;
        const scrollBlockHeight = $scrollBlock.height();
        const scrollValue = $scrollBlock.scrollTop();

        if (scrollToOffset - scrollBlockOffset + scrollToHeight > scrollBlockHeight) {

            $scrollBlock.scrollTop(
                scrollToOffset - scrollBlockOffset
                    + scrollToHeight - scrollBlockHeight + scrollValue + 8
            );
        }
        else if (scrollToOffset < scrollBlockOffset) {

            $scrollBlock.scrollTop(
                scrollToOffset - scrollBlockOffset + scrollValue - 8
            );
        }
    }
}

function reselect(n) {
    'use strict';

    if (d) {
        console.debug('reselect(%s)', n, [window.selectionManager]);
    }
    if (window.selectionManager) {
        return selectionManager.reinitialize();
    }
    $('.ui-selected').removeClass('ui-selected');

    if (!Array.isArray($.selected)) {
        $.selected = [];
    }

    var ids = $.selected.map((h) => {
        if (h && typeof h === 'object') {
            h = h.h;
        }
        return String(h).replace(/[^\w-]/g, '');
    });

    if (window.selectionManager) {
        selectionManager.clear_selection();
    }

    for (var i = ids.length; i--;) {
        if (window.selectionManager) {
            selectionManager.add_to_selection(ids[i], n, i);
        }
        $('#' + ids[i]).addClass('ui-selected');

        if (n) {
            $('#' + ids[i] + ' .grid-status-icon').addClass('new');
            $('#' + ids[i] + ' .file-status-icon').addClass('new');
        }
    }

    if (n && is_mobile) {
        if ($.selected.length) {
            mobile.cloud.scrollToFile($.selected[0]);
        }
    }
    else if (n) {
        let $el;
        let $scrollBlock;

        if (M.viewmode) {
            $scrollBlock = $('.file-block-scrolling.ps:not(.hidden, .megaList)');
            $el = $('a.ui-selected');
        }
        else {
            $scrollBlock = $('.grid-scrolling-table.ps:not(.hidden, .megaList)');
            $el = $('tr.ui-selected');
        }

        if ($el.length && $scrollBlock.length) {
            $scrollBlock.scrollTop($el.position().top + $scrollBlock.scrollTop());
        }
    }
}
