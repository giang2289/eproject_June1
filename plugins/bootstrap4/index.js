//
// SmoothScroll for websites v1.4.9 (Balazs Galambosi)
// http://www.smoothscroll.net/
//
// Licensed under the terms of the MIT license.
//
// You may use it in your theme if you credit me.
// It is also free to use on any individual website.
//
// Exception:
// The only restriction is to not publish any
// extension for browsers or native application
// without getting a written permission first.
//

(function () {

    // Scroll Variables (tweakable)
        var defaultOptions = {
    
            // Scrolling Core
            frameRate        : 150, // [Hz]
            animationTime    : 400, // [ms]
            stepSize         : 100, // [px]
    
            // Pulse (less tweakable)
            // ratio of "tail" to "acceleration"
            pulseAlgorithm   : true,
            pulseScale       : 4,
            pulseNormalize   : 1,
    
            // Acceleration
            accelerationDelta : 50,  // 50
            accelerationMax   : 3,   // 3
    
            // Keyboard Settings
            keyboardSupport   : true,  // option
            arrowScroll       : 50,    // [px]
    
            // Other
            fixedBackground   : true,
            excluded          : ''
        };
    
        var options = defaultOptions;
    
    
    // Other Variables
        var isExcluded = false;
        var isFrame = false;
        var direction = { x: 0, y: 0 };
        var initDone  = false;
        var root = document.documentElement;
        var activeElement;
        var observer;
        var refreshSize;
        var deltaBuffer = [];
        var deltaBufferTimer;
        var isMac = /^Mac/.test(navigator.platform);
    
        var key = { left: 37, up: 38, right: 39, down: 40, spacebar: 32,
            pageup: 33, pagedown: 34, end: 35, home: 36 };
        var arrowKeys = { 37: 1, 38: 1, 39: 1, 40: 1 };
    
        /***********************************************
         * INITIALIZE
         ***********************************************/
    
        /**
         * Tests if smooth scrolling is allowed. Shuts down everything if not.
         */
        function initTest() {
            if (options.keyboardSupport) {
                addEvent('keydown', keydown);
            }
        }
    
        /**
         * Sets up scrolls array, determines if frames are involved.
         */
        function init() {
    
            if (initDone || !document.body) return;
    
            initDone = true;
    
            var body = document.body;
            var html = document.documentElement;
            var windowHeight = window.innerHeight;
            var scrollHeight = body.scrollHeight;
    
            // check compat mode for root element
            root = (document.compatMode.indexOf('CSS') >= 0) ? html : body;
            activeElement = body;
    
            initTest();
    
            // Checks if this script is running in a frame
            if (top != self) {
                isFrame = true;
            }
    
            /**
             * Safari 10 fixed it, Chrome fixed it in v45:
             * This fixes a bug where the areas left and right to
             * the content does not trigger the onmousewheel event
             * on some pages. e.g.: html, body { height: 100% }
             */
            else if (isOldSafari &&
                scrollHeight > windowHeight &&
                (body.offsetHeight <= windowHeight ||
                    html.offsetHeight <= windowHeight)) {
    
                var fullPageElem = document.createElement('div');
                fullPageElem.style.cssText = 'position:absolute; z-index:-10000; ' +
                    'top:0; left:0; right:0; height:' +
                    root.scrollHeight + 'px';
                document.body.appendChild(fullPageElem);
    
                // DOM changed (throttled) to fix height
                var pendingRefresh;
                refreshSize = function () {
                    if (pendingRefresh) return; // could also be: clearTimeout(pendingRefresh);
                    pendingRefresh = setTimeout(function () {
                        if (isExcluded) return; // could be running after cleanup
                        fullPageElem.style.height = '0';
                        fullPageElem.style.height = root.scrollHeight + 'px';
                        pendingRefresh = null;
                    }, 500); // act rarely to stay fast
                };
    
                setTimeout(refreshSize, 10);
    
                addEvent('resize', refreshSize);
    
                // TODO: attributeFilter?
                var config = {
                    attributes: true,
                    childList: true,
                    characterData: false
                    // subtree: true
                };
    
                observer = new MutationObserver(refreshSize);
                observer.observe(body, config);
    
                if (root.offsetHeight <= windowHeight) {
                    var clearfix = document.createElement('div');
                    clearfix.style.clear = 'both';
                    body.appendChild(clearfix);
                }
            }
    
            // disable fixed background
            if (!options.fixedBackground && !isExcluded) {
                body.style.backgroundAttachment = 'scroll';
                html.style.backgroundAttachment = 'scroll';
            }
        }
    
        /**
         * Removes event listeners and other traces left on the page.
         */
        function cleanup() {
            observer && observer.disconnect();
            removeEvent(wheelEvent, wheel);
            removeEvent('mousedown', mousedown);
            removeEvent('keydown', keydown);
            removeEvent('resize', refreshSize);
            removeEvent('load', init);
        }
    
    
        /************************************************
         * SCROLLING
         ************************************************/
    
        var que = [];
        var pending = false;
        var lastScroll = Date.now();
    
        /**
         * Pushes scroll actions to the scrolling queue.
         */
        function scrollArray(elem, left, top) {
    
            directionCheck(left, top);
    
            if (options.accelerationMax != 1) {
                var now = Date.now();
                var elapsed = now - lastScroll;
                if (elapsed < options.accelerationDelta) {
                    var factor = (1 + (50 / elapsed)) / 2;
                    if (factor > 1) {
                        factor = Math.min(factor, options.accelerationMax);
                        left *= factor;
                        top  *= factor;
                    }
                }
                lastScroll = Date.now();
            }
    
            // push a scroll command
            que.push({
                x: left,
                y: top,
                lastX: (left < 0) ? 0.99 : -0.99,
                lastY: (top  < 0) ? 0.99 : -0.99,
                start: Date.now()
            });
    
            // don't act if there's a pending queue
            if (pending) {
                return;
            }
    
            var scrollRoot = getScrollRoot();
            var isWindowScroll = (elem === scrollRoot || elem === document.body);
    
            // if we haven't already fixed the behavior,
            // and it needs fixing for this sesh
            if (elem.$scrollBehavior == null && isScrollBehaviorSmooth(elem)) {
                elem.$scrollBehavior = elem.style.scrollBehavior;
                elem.style.scrollBehavior = 'auto';
            }
    
            var step = function (time) {
    
                var now = Date.now();
                var scrollX = 0;
                var scrollY = 0;
    
                for (var i = 0; i < que.length; i++) {
    
                    var item = que[i];
                    var elapsed  = now - item.start;
                    var finished = (elapsed >= options.animationTime);
    
                    // scroll position: [0, 1]
                    var position = (finished) ? 1 : elapsed / options.animationTime;
    
                    // easing [optional]
                    if (options.pulseAlgorithm) {
                        position = pulse(position);
                    }
    
                    // only need the difference
                    var x = (item.x * position - item.lastX) >> 0;
                    var y = (item.y * position - item.lastY) >> 0;
    
                    // add this to the total scrolling
                    scrollX += x;
                    scrollY += y;
    
                    // update last values
                    item.lastX += x;
                    item.lastY += y;
    
                    // delete and step back if it's over
                    if (finished) {
                        que.splice(i, 1); i--;
                    }
                }
    
                // scroll left and top
                if (isWindowScroll) {
                    window.scrollBy(scrollX, scrollY);
                }
                else {
                    if (scrollX) elem.scrollLeft += scrollX;
                    if (scrollY) elem.scrollTop  += scrollY;
                }
    
                // clean up if there's nothing left to do
                if (!left && !top) {
                    que = [];
                }
    
                if (que.length) {
                    requestFrame(step, elem, (1000 / options.frameRate + 1));
                } else {
                    pending = false;
                    // restore default behavior at the end of scrolling sesh
                    if (elem.$scrollBehavior != null) {
                        elem.style.scrollBehavior = elem.$scrollBehavior;
                        elem.$scrollBehavior = null;
                    }
                }
            };
    
            // start a new queue of actions
            requestFrame(step, elem, 0);
            pending = true;
        }
    
    
        /***********************************************
         * EVENTS
         ***********************************************/
    
        /**
         * Mouse wheel handler.
         * @param {Object} event
         */
        function wheel(event) {
    
            if (!initDone) {
                init();
            }
    
            var target = event.target;
    
            // leave early if default action is prevented
            // or it's a zooming event with CTRL
            if (event.defaultPrevented || event.ctrlKey) {
                return true;
            }
    
            // leave embedded content alone (flash & pdf)
            if (isNodeName(activeElement, 'embed') ||
                (isNodeName(target, 'embed') && /\.pdf/i.test(target.src)) ||
                isNodeName(activeElement, 'object') ||
                target.shadowRoot) {
                return true;
            }
    
            var deltaX = -event.wheelDeltaX || event.deltaX || 0;
            var deltaY = -event.wheelDeltaY || event.deltaY || 0;
    
            if (isMac) {
                if (event.wheelDeltaX && isDivisible(event.wheelDeltaX, 120)) {
                    deltaX = -120 * (event.wheelDeltaX / Math.abs(event.wheelDeltaX));
                }
                if (event.wheelDeltaY && isDivisible(event.wheelDeltaY, 120)) {
                    deltaY = -120 * (event.wheelDeltaY / Math.abs(event.wheelDeltaY));
                }
            }
    
            // use wheelDelta if deltaX/Y is not available
            if (!deltaX && !deltaY) {
                deltaY = -event.wheelDelta || 0;
            }
    
            // line based scrolling (Firefox mostly)
            if (event.deltaMode === 1) {
                deltaX *= 40;
                deltaY *= 40;
            }
    
            var overflowing = overflowingAncestor(target);
    
            // nothing to do if there's no element that's scrollable
            if (!overflowing) {
                // except Chrome iframes seem to eat wheel events, which we need to
                // propagate up, if the iframe has nothing overflowing to scroll
                if (isFrame && isChrome)  {
                    // change target to iframe element itself for the parent frame
                    Object.defineProperty(event, "target", {value: window.frameElement});
                    event = new event.constructor(event.type, event); // redefine event because already dispatched
                    return parent.dispatchEvent(event);
                }
                return true;
            }
    
            // check if it's a touchpad scroll that should be ignored
            if (isTouchpad(deltaY)) {
                return true;
            }
    
            // scale by step size
            // delta is 120 most of the time
            // synaptics seems to send 1 sometimes
            if (Math.abs(deltaX) > 1.2) {
                deltaX *= options.stepSize / 120;
            }
            if (Math.abs(deltaY) > 1.2) {
                deltaY *= options.stepSize / 120;
            }
    
            scrollArray(overflowing, deltaX, deltaY);
            event.preventDefault();
            scheduleClearCache();
        }
    
        /**
         * Keydown event handler.
         * @param {Object} event
         */
        function keydown(event) {
    
            var target   = event.target;
            var modifier = event.ctrlKey || event.altKey || event.metaKey ||
                (event.shiftKey && event.keyCode !== key.spacebar);
    
            // our own tracked active element could've been removed from the DOM
            if (!document.body.contains(activeElement)) {
                activeElement = document.activeElement;
            }
    
            // do nothing if user is editing text
            // or using a modifier key (except shift)
            // or in a dropdown
            // or inside interactive elements
            var inputNodeNames = /^(textarea|select|embed|object)$/i;
            var buttonTypes = /^(button|submit|radio|checkbox|file|color|image)$/i;
            if ( event.defaultPrevented ||
                inputNodeNames.test(target.nodeName) ||
                isNodeName(target, 'input') && !buttonTypes.test(target.type) ||
                isNodeName(activeElement, 'video') ||
                isInsideYoutubeVideo(event) ||
                target.isContentEditable ||
                modifier ) {
                return true;
            }
    
            // [spacebar] should trigger button press, leave it alone
            if ((isNodeName(target, 'button') ||
                isNodeName(target, 'input') && buttonTypes.test(target.type)) &&
                event.keyCode === key.spacebar) {
                return true;
            }
    
            // [arrwow keys] on radio buttons should be left alone
            if (isNodeName(target, 'input') && target.type == 'radio' &&
                arrowKeys[event.keyCode])  {
                return true;
            }
    
            var shift, x = 0, y = 0;
            var overflowing = overflowingAncestor(activeElement);
    
            if (!overflowing) {
                // Chrome iframes seem to eat key events, which we need to
                // propagate up, if the iframe has nothing overflowing to scroll
                return (isFrame && isChrome) ? parent.keydown(event) : true;
            }
    
            var clientHeight = overflowing.clientHeight;
    
            if (overflowing == document.body) {
                clientHeight = window.innerHeight;
            }
    
            switch (event.keyCode) {
                case key.up:
                    y = -options.arrowScroll;
                    break;
                case key.down:
                    y = options.arrowScroll;
                    break;
                case key.spacebar: // (+ shift)
                    shift = event.shiftKey ? 1 : -1;
                    y = -shift * clientHeight * 0.9;
                    break;
                case key.pageup:
                    y = -clientHeight * 0.9;
                    break;
                case key.pagedown:
                    y = clientHeight * 0.9;
                    break;
                case key.home:
                    if (overflowing == document.body && document.scrollingElement)
                        overflowing = document.scrollingElement;
                    y = -overflowing.scrollTop;
                    break;
                case key.end:
                    var scroll = overflowing.scrollHeight - overflowing.scrollTop;
                    var scrollRemaining = scroll - clientHeight;
                    y = (scrollRemaining > 0) ? scrollRemaining + 10 : 0;
                    break;
                case key.left:
                    x = -options.arrowScroll;
                    break;
                case key.right:
                    x = options.arrowScroll;
                    break;
                default:
                    return true; // a key we don't care about
            }
    
            scrollArray(overflowing, x, y);
            event.preventDefault();
            scheduleClearCache();
        }
    
        /**
         * Mousedown event only for updating activeElement
         */
        function mousedown(event) {
            activeElement = event.target;
        }
    
    
        /***********************************************
         * OVERFLOW
         ***********************************************/
    
        var uniqueID = (function () {
            var i = 0;
            return function (el) {
                return el.uniqueID || (el.uniqueID = i++);
            };
        })();
    
        var cacheX = {}; // cleared out after a scrolling session
        var cacheY = {}; // cleared out after a scrolling session
        var clearCacheTimer;
        var smoothBehaviorForElement = {};
    
    //setInterval(function () { cache = {}; }, 10 * 1000);
    
        function scheduleClearCache() {
            clearTimeout(clearCacheTimer);
            clearCacheTimer = setInterval(function () {
                cacheX = cacheY = smoothBehaviorForElement = {};
            }, 1*1000);
        }
    
        function setCache(elems, overflowing, x) {
            var cache = x ? cacheX : cacheY;
            for (var i = elems.length; i--;)
                cache[uniqueID(elems[i])] = overflowing;
            return overflowing;
        }
    
        function getCache(el, x) {
            return (x ? cacheX : cacheY)[uniqueID(el)];
        }
    
    //  (body)                (root)
    //         | hidden | visible | scroll |  auto  |
    // hidden  |   no   |    no   |   YES  |   YES  |
    // visible |   no   |   YES   |   YES  |   YES  |
    // scroll  |   no   |   YES   |   YES  |   YES  |
    // auto    |   no   |   YES   |   YES  |   YES  |
    
        function overflowingAncestor(el) {
            var elems = [];
            var body = document.body;
            var rootScrollHeight = root.scrollHeight;
            do {
                var cached = getCache(el, false);
                if (cached) {
                    return setCache(elems, cached);
                }
                elems.push(el);
                if (rootScrollHeight === el.scrollHeight) {
                    var topOverflowsNotHidden = overflowNotHidden(root) && overflowNotHidden(body);
                    var isOverflowCSS = topOverflowsNotHidden || overflowAutoOrScroll(root);
                    if (isFrame && isContentOverflowing(root) ||
                        !isFrame && isOverflowCSS) {
                        return setCache(elems, getScrollRoot());
                    }
                } else if (isContentOverflowing(el) && overflowAutoOrScroll(el)) {
                    return setCache(elems, el);
                }
            } while ((el = el.parentElement));
        }
    
        function isContentOverflowing(el) {
            return (el.clientHeight + 10 < el.scrollHeight);
        }
    
    // typically for <body> and <html>
        function overflowNotHidden(el) {
            var overflow = getComputedStyle(el, '').getPropertyValue('overflow-y');
            return (overflow !== 'hidden');
        }
    
    // for all other elements
        function overflowAutoOrScroll(el) {
            var overflow = getComputedStyle(el, '').getPropertyValue('overflow-y');
            return (overflow === 'scroll' || overflow === 'auto');
        }
    
    // for all other elements
        function isScrollBehaviorSmooth(el) {
            var id = uniqueID(el);
            if (smoothBehaviorForElement[id] == null) {
                var scrollBehavior = getComputedStyle(el, '')['scroll-behavior'];
                smoothBehaviorForElement[id] = ('smooth' == scrollBehavior);
            }
            return smoothBehaviorForElement[id];
        }
    
    
        /***********************************************
         * HELPERS
         ***********************************************/
    
        function addEvent(type, fn, arg) {
            window.addEventListener(type, fn, arg || false);
        }
    
        function removeEvent(type, fn, arg) {
            window.removeEventListener(type, fn, arg || false);
        }
    
        function isNodeName(el, tag) {
            return el && (el.nodeName||'').toLowerCase() === tag.toLowerCase();
        }
    
        function directionCheck(x, y) {
            x = (x > 0) ? 1 : -1;
            y = (y > 0) ? 1 : -1;
            if (direction.x !== x || direction.y !== y) {
                direction.x = x;
                direction.y = y;
                que = [];
                lastScroll = 0;
            }
        }
    
        if (window.localStorage && localStorage.SS_deltaBuffer) {
            try { // #46 Safari throws in private browsing for localStorage
                deltaBuffer = localStorage.SS_deltaBuffer.split(',');
            } catch (e) { }
        }
    
        function isTouchpad(deltaY) {
            if (!deltaY) return;
            if (!deltaBuffer.length) {
                deltaBuffer = [deltaY, deltaY, deltaY];
            }
            deltaY = Math.abs(deltaY);
            deltaBuffer.push(deltaY);
            deltaBuffer.shift();
            clearTimeout(deltaBufferTimer);
            deltaBufferTimer = setTimeout(function () {
                try { // #46 Safari throws in private browsing for localStorage
                    localStorage.SS_deltaBuffer = deltaBuffer.join(',');
                } catch (e) { }
            }, 1000);
            var dpiScaledWheelDelta = deltaY > 120 && allDeltasDivisableBy(deltaY); // win64
            return !allDeltasDivisableBy(120) && !allDeltasDivisableBy(100) && !dpiScaledWheelDelta;
        }
    
        function isDivisible(n, divisor) {
            return (Math.floor(n / divisor) == n / divisor);
        }
    
        function allDeltasDivisableBy(divisor) {
            return (isDivisible(deltaBuffer[0], divisor) &&
                isDivisible(deltaBuffer[1], divisor) &&
                isDivisible(deltaBuffer[2], divisor));
        }
    
        function isInsideYoutubeVideo(event) {
            var elem = event.target;
            var isControl = false;
            if (document.URL.indexOf ('www.youtube.com/watch') != -1) {
                do {
                    isControl = (elem.classList &&
                        elem.classList.contains('html5-video-controls'));
                    if (isControl) break;
                } while ((elem = elem.parentNode));
            }
            return isControl;
        }
    
        var requestFrame = (function () {
            return (window.requestAnimationFrame       ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame    ||
                function (callback, element, delay) {
                    window.setTimeout(callback, delay || (1000/60));
                });
        })();
    
        var MutationObserver = (window.MutationObserver ||
            window.WebKitMutationObserver ||
            window.MozMutationObserver);
    
        var getScrollRoot = (function() {
            var SCROLL_ROOT = document.scrollingElement;
            return function() {
                if (!SCROLL_ROOT) {
                    var dummy = document.createElement('div');
                    dummy.style.cssText = 'height:10000px;width:1px;';
                    document.body.appendChild(dummy);
                    var bodyScrollTop  = document.body.scrollTop;
                    var docElScrollTop = document.documentElement.scrollTop;
                    window.scrollBy(0, 3);
                    if (document.body.scrollTop != bodyScrollTop)
                        (SCROLL_ROOT = document.body);
                    else
                        (SCROLL_ROOT = document.documentElement);
                    window.scrollBy(0, -3);
                    document.body.removeChild(dummy);
                }
                return SCROLL_ROOT;
            };
        })();
    
    
        /***********************************************
         * PULSE (by Michael Herf)
         ***********************************************/
    
        /**
         * Viscous fluid with a pulse for part and decay for the rest.
         * - Applies a fixed force over an interval (a damped acceleration), and
         * - Lets the exponential bleed away the velocity over a longer interval
         * - Michael Herf, http://stereopsis.com/stopping/
         */
        function pulse_(x) {
            var val, start, expx;
            // test
            x = x * options.pulseScale;
            if (x < 1) { // acceleartion
                val = x - (1 - Math.exp(-x));
            } else {     // tail
                // the previous animation ended here:
                start = Math.exp(-1);
                // simple viscous drag
                x -= 1;
                expx = 1 - Math.exp(-x);
                val = start + (expx * (1 - start));
            }
            return val * options.pulseNormalize;
        }
    
        function pulse(x) {
            if (x >= 1) return 1;
            if (x <= 0) return 0;
    
            if (options.pulseNormalize == 1) {
                options.pulseNormalize /= pulse_(1);
            }
            return pulse_(x);
        }
    
    
        /***********************************************
         * FIRST RUN
         ***********************************************/
    
        var userAgent = window.navigator.userAgent;
        var isEdge    = /Edge/.test(userAgent); // thank you MS
        var isChrome  = /chrome/i.test(userAgent) && !isEdge;
        var isSafari  = /safari/i.test(userAgent) && !isEdge;
        var isMobile  = /mobile/i.test(userAgent);
        var isIEWin7  = /Windows NT 6.1/i.test(userAgent) && /rv:11/i.test(userAgent);
        var isOldSafari = isSafari && (/Version\/8/i.test(userAgent) || /Version\/9/i.test(userAgent));
        var isEnabledForBrowser = (isChrome || isSafari || isIEWin7) && !isMobile;
    
        var supportsPassive = false;
        try {
            window.addEventListener("test", null, Object.defineProperty({}, 'passive', {
                get: function () {
                    supportsPassive = true;
                }
            }));
        } catch(e) {}
    
        var wheelOpt = supportsPassive ? { passive: false } : false;
        var wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';
    
        if (wheelEvent && isEnabledForBrowser) {
            addEvent(wheelEvent, wheel, wheelOpt);
            addEvent('mousedown', mousedown);
            addEvent('load', init);
        }
    
    
        /***********************************************
         * PUBLIC INTERFACE
         ***********************************************/
    
        function SmoothScroll(optionsToSet) {
            for (var key in optionsToSet)
                if (defaultOptions.hasOwnProperty(key))
                    options[key] = optionsToSet[key];
        }
        SmoothScroll.destroy = cleanup;
    
        if (window.SmoothScrollOptions) // async API
            SmoothScroll(window.SmoothScrollOptions);
    
        if (typeof define === 'function' && define.amd)
            define(function() {
                return SmoothScroll;
            });
        else if ('object' == typeof exports)
            module.exports = SmoothScroll;
        else
            window.SmoothScroll = SmoothScroll;
    
    })();

    (function($){

        var NAME = 'navDropdown';
        var DATA_KEY = 'bs.nav-dropdown';
        var EVENT_KEY = '.' + DATA_KEY;
        var DATA_API_KEY = '.data-api';
        var JQUERY_NO_CONFLICT = $.fn[NAME];
    
        var Event = {
            HIDE: 'hide' + EVENT_KEY,
            HIDDEN: 'hidden' + EVENT_KEY,
            SHOW: 'show' + EVENT_KEY,
            SHOWN: 'shown' + EVENT_KEY,
            CLICK: 'click' + EVENT_KEY,
            READY: 'ready' + EVENT_KEY,
            COLLAPSE: 'collapse' + EVENT_KEY,
            LOAD_DATA_API: 'ready' + EVENT_KEY + DATA_API_KEY,
            CLICK_DATA_API: 'click' + EVENT_KEY + DATA_API_KEY,
            RESIZE_DATA_API: 'resize' + EVENT_KEY + DATA_API_KEY,
            KEYDOWN_DATA_API: 'keydown' + EVENT_KEY + DATA_API_KEY,
            NAVBAR_COLLAPSE: 'collapse.bs.navbar-dropdown'
        };
    
        var Hotkeys = {
            ESC: 27,
            LEFT: 37,
            UP: 38,
            RIGHT: 39,
            DOWN: 40
        };
    
        var Breakpoints = {
            XS: 544,
            SM: 768,
            MD: 992,
            LG: 1200,
            XL: Infinity
        };
    
        var ClassName = {
            BACKDROP: 'dropdown-backdrop',
            DISABLED: 'disabled',
            OPEN: 'open',
            SM: 'nav-dropdown-sm'
        };
    
        var Selector = {
            BASE: '.nav-dropdown',
            DROPDOWN: '.dropdown',
            DROPDOWN_MENU: '.dropdown-menu',
            BACKDROP: '.' + ClassName.BACKDROP,
            DATA_BUTTON: '[data-button]',
            DATA_TOGGLE: '[data-toggle="dropdown-submenu"]',
            FORM_CHILD: '.dropdown form'
        };
    
    
    
        var $$ = (function(){
    
            function Item(elements, prevItem) {
                if (!('length' in elements)) elements = [elements];
                this.props = {};
                this.length = elements.length;
                if (prevItem) {
                    this.prevItem = prevItem;
                    $.extend(this.props, prevItem.props);
                }
                for (var i = 0; i < elements.length; i++) {
                    this[i] = elements[i];
                }
            }
    
            Item.prototype.eq = function(index) {
                return new Item(this[index] ? this[index] : [], this);
            };
    
            Item.prototype.parent = function() {
                return new Item(
                    
                    $(this).map(function(){
    
                        var $$this = new Item(this);
    
                        if ($$this.is(':upper')) return null;
    
                        return $( $$this.is(':toggle') ? this.parentNode.parentNode : this )
                            .closest(Selector.DROPDOWN)
                            .find('>' + Selector.DATA_TOGGLE)[0];
    
                    }),
    
                    this
    
                );
            };
    
            Item.prototype.parents = function(selector) {
                var elements = $(this).map(function(){
    
                    return (new Item(this)).is(':toggle') ? this.parentNode : this;
    
                }).parentsUntil(Selector.BASE, Selector.DROPDOWN);
    
                if (selector === ':upper') elements = elements.last();
                    
                elements = elements.find('>' + Selector.DATA_TOGGLE);
    
                return new Item(elements, this);
            };
    
            Item.prototype.children = function(deepSearch) {
    
                var elements = [];
    
                $(this).each(function(){
    
                    var $parent, $items, $$item = new Item(this);
    
                    if ($$item.is(':root')) {
                        $parent = $(this);
                    } else if ($$item.is(':toggle')) {
                        $parent = $(this).parent().find('>' + Selector.DROPDOWN_MENU);
                    } else {
                        return;
                    }
    
                    if (deepSearch) {
                        $items = $parent.find('a');
                    } else if ($$item.is(':root')) {
                        $items = $parent.find('>li>a');
                    } else {
                        $items = $parent.find('>a, >' + Selector.DROPDOWN + '>a');
                    }
    
                    $items.each(function(){
    
                        if ((deepSearch && !this.offsetWidth && !this.offsetHeight)
                            || this.disabled || $(this).is(Selector.DATA_BUTTON) || $(this).hasClass(ClassName.DISABLED) || ~$.inArray(this, elements)) {
                            return;
                        }
    
                        elements.push(this);
    
                    });
    
                });
    
                return new Item(elements, this);
    
            };
    
            Item.prototype.root = function() {
                return new Item(
                    $(this).closest(Selector.BASE),
                    this
                );
            };
    
            Item.prototype.jump = function(step) {
                step = step || 'next';
                
                if (!this.length) {
                    return new Item([], this);
                }
                
                var children, $$item = this.eq(0);
                if (this.is(':flat') || $$item.is(':upper')) {
                    children = $$item.root().children( this.is(':flat') );
                } else {
                    children = $$item.parent().children();
                }
    
                var index = $.inArray(this[0], children);
                if (!children.length || !~index) {
                    return new Item([], this);
                }
    
                if (step == 'next') {
                    index += 1;
                    if (index < children.length) {
                        return new Item(children[index], this);
                    }
                    step = 'first';
                } else if (step == 'prev') {
                    index -= 1;
                    if (index >= 0) {
                        return new Item(children[index], this);
                    }
                    step = 'last';
                }
    
                if (step == 'first') return new Item(children[0], this);
                if (step == 'last') return new Item(children[ children.length - 1 ], this);
    
                return new Item([], this);
            };
    
            Item.prototype.next = function() {
                return this.jump('next');
            };
    
            Item.prototype.prev = function() {
                return this.jump('prev');
            };
    
            Item.prototype.first = function() {
                return this.jump('first');
            };
    
            Item.prototype.last = function() {
                return this.jump('last');
            };
    
            Item.prototype.prop = function(name, value) {
                if (arguments.length) {
                    if (arguments.length > 1) {
                        this.props[name] = value;
                        return this;
                    }
                    if (typeof arguments[0] == 'object') {
                        $.extend(this.props, arguments[0]);
                        return this;
                    }
                    return (name in this.props) ?
                        this.props[name] : null;
                }
                return $.extend({}, this.props);
            };
    
            Item.prototype.removeProp = function(name) {
                delete this.props[name];
                return this;
            };
    
            Item.prototype.is = function(selector) {
                var $this = $(this),
                    selectors = (selector || '').split(/(?=[*#.\[:\s])/);
                
                while (selector = selectors.pop()){
                
                    switch (selector){
                    
                        case ':root':
                            if (!$this.is(Selector.BASE))
                                return false;
                            break;
    
                        case ':upper':
                            if (!$this.parent().parent().is(Selector.BASE))
                                return false;
                            break;
    
                        case ':opened':
                        case ':closed':
                            if ((selector == ':opened') != $this.parent().hasClass(ClassName.OPEN))
                                return false;
                        case ':toggle':
                            if (!$this.is(Selector.DATA_TOGGLE))
                                return false;
                            break;
    
                        default:
                            if (!this.props[selector])
                                return false;
                            break;
    
                    }
    
                }
    
                return true;
            };
    
            Item.prototype.open = function() {
                if (this.is(':closed')) {
                    this.click();
                }
                return this;
            };
    
            Item.prototype.close = function() {
                if (this.is(':opened')) {
                    this.click();
                }
                return this;
            };
    
            Item.prototype.focus = function() {
                if (this.length) {
                    this[0].focus();
                }
                return this;
            };
    
            Item.prototype.click = function() {
                if (this.length) {
                    $(this[0]).trigger('click');
                }
                return this;
            }
    
            return function(element) {
                return new Item(element);
            };
    
        })();
    
    
    
        var NavDropdown = function(element){
            this._element = element;
            $(this._element).on(Event.CLICK, this.toggle);
        };
    
        NavDropdown.prototype.toggle = function(event) {        
            if (this.disabled || $(this).hasClass(ClassName.DISABLED)) {
                return false;
            }
    
            var $parent = $(this.parentNode);
            var isActive = $parent.hasClass(ClassName.OPEN);
            var isCollapsed = NavDropdown._isCollapsed( $(this).closest(Selector.BASE) );
    
            NavDropdown._clearMenus(
                $.Event('click', {
                    target: this,
                    data: {
                        toggles: isCollapsed ? [this] : null
                    }
                })
            );
    
            if (isActive) {
                return false;
            }
    
            if ('ontouchstart' in document.documentElement
                && !$parent.closest(Selector.DROPDOWN + '.' + ClassName.OPEN).length) {
            
                // if mobile we use a backdrop because click events don't delegate
                var dropdown = document.createElement('div');
                dropdown.className = ClassName.BACKDROP;
                $(dropdown).insertBefore( $(this).closest(Selector.BASE) );
                $(dropdown).on('click', NavDropdown._clearMenus);
    
            }
    
            var relatedTarget = { relatedTarget: this };
            var showEvent = $.Event(Event.SHOW, relatedTarget);
    
            $parent.trigger(showEvent);
    
            if (showEvent.isDefaultPrevented()) {
                return false;
            }
    
            this.focus();
            this.setAttribute('aria-expanded', 'true');
    
            $parent.toggleClass(ClassName.OPEN);
            $parent.trigger( $.Event(Event.SHOWN, relatedTarget) );
    
            return false;
        };
    
        NavDropdown.prototype.dispose = function() {
            $.removeData(this._element, DATA_KEY);
            $(this._element).off(EVENT_KEY);
            this._element = null;
        };
    
        NavDropdown._clearMenus = function(event) {
            event = event || {};
    
            if (event.which === 3) {
                return;
            }
    
            var collapseEvent;
            var filter = function(){ return false; };
    
            if (event.target) {
    
                if (this === document) {
    
                    if ( $(event.target).is('a:not([disabled], .' + ClassName.DISABLED +  ')') ) {
                        collapseEvent = $.Event(Event.COLLAPSE, { relatedTarget: event.target })
                    } else  {
    
                        var $rootNode = (event.targetWrapper && $(event.targetWrapper).find(Selector.BASE)) || $(event.target).closest(Selector.BASE);
    
                        if (NavDropdown._isCollapsed($rootNode)) return;
                    }
    
                } else {
    
                    if ($(event.target).hasClass(ClassName.BACKDROP)) {
                        var $nextNode = $(event.target).next();
                        if ($nextNode.is(Selector.BASE) && NavDropdown._isCollapsed($nextNode)) {
                            return;
                        }
                    }
    
                }
    
                if ($(event.target).is(Selector.DATA_TOGGLE)) {
                    filter = $(event.target.parentNode).parents(Selector.DROPDOWN).find('>' + Selector.DATA_TOGGLE);
                } else {
                    $(Selector.BACKDROP).remove();
                }
    
            }
    
            var toggles = (event.data && event.data.toggles && $(event.data.toggles).parent().find(Selector.DATA_TOGGLE)) || $.makeArray( $(Selector.DATA_TOGGLE).not(filter) );
    
            for (var i = 0; i < toggles.length; i++) {
    
                var parent = toggles[i].parentNode;
                var relatedTarget = { relatedTarget: toggles[i] };
    
                if (!$(parent).hasClass(ClassName.OPEN)) {
                    continue;
                }
    
                if (event.type === 'click' &&
                    (/input|textarea/i.test(event.target.tagName)) &&
                    ($.contains(parent, event.target))) {
                    continue;
                }
    
                var hideEvent = $.Event(Event.HIDE, relatedTarget);
                $(parent).trigger(hideEvent);
                if (hideEvent.isDefaultPrevented()) {
                    continue;
                }
    
                toggles[i].setAttribute('aria-expanded', 'false');
    
                $(parent)
                    .removeClass(ClassName.OPEN)
                    .trigger( $.Event(Event.HIDDEN, relatedTarget) );
                    
            }
    
            if (collapseEvent) {
                $(document).trigger(collapseEvent);
            }
    
        };
    
        // static
        NavDropdown._dataApiKeydownHandler = function(event) {
    
              if (/input|textarea/i.test(event.target.tagName)) {
                return;
              }
    
              // ????
              var found;
              for (var k in Hotkeys) {
                if (found = (Hotkeys[k] === event.which)) {
                    break;
                }
              }
              if (!found) return;
    
              event.preventDefault();
              event.stopPropagation();
    
              if (event.which == Hotkeys.ESC) {
    
                if (NavDropdown._isCollapsed(this)) {
                    return;
                }
    
                var toggle = $(event.target).parents(Selector.DROPDOWN + '.' + ClassName.OPEN)
                    .last().find('>' + Selector.DATA_TOGGLE);
                NavDropdown._clearMenus();
                toggle.trigger('focus');
                return;
    
              }
    
              if (event.target.tagName != 'A') {
                return;
              }
    
              var $$item = $$(event.target);
              
              $$item.prop(':flat', NavDropdown._isCollapsed($$item.root()));
    
              if ($$item.is(':flat')){
    
                if (event.which === Hotkeys.DOWN || event.which === Hotkeys.UP) {
    
                    $$item[ event.which === Hotkeys.UP ? 'prev' : 'next' ]().focus();
    
                } else if (event.which === Hotkeys.LEFT) {
                    
                    if ($$item.is(':opened')) {
                        $$item.close();
                    } else {
                        $$item.parent().close().focus();
                    }
    
                } else if (event.which === Hotkeys.RIGHT && $$item.is(':toggle')) {
                    $$item.open();
                }
    
              } else if ($$item.is(':upper')) {
              
                  if (event.which === Hotkeys.LEFT || event.which === Hotkeys.RIGHT) {
    
                    $$item[event.which === Hotkeys.LEFT ? 'prev' : 'next']().focus().open();
                    if ($$item.is(':toggle')) $$item.close();
    
                  } else if ((event.which === Hotkeys.DOWN || event.which === Hotkeys.UP) && $$item.is(':toggle')) {
    
                    $$item.children()[ event.which === Hotkeys.DOWN ? 'first' : 'last' ]().focus();
    
                  }
    
              } else {
    
                  if (event.which === Hotkeys.LEFT) {
    
                    var $$parent = $$item.parent();
                    
                    if ($$parent.is(':upper')) {
                        $$parent.close().prev().focus().open();
                    } else {
                        $$parent.focus().close();
                    }
    
                  } else if (event.which === Hotkeys.RIGHT) {
                    
                    var $$children = $$item.children();
                    if ($$children.length) {
                        $$item.open();
                        $$children.first().focus();
                    } else {
                        $$item.parents(':upper').close().next().focus().open();
                    }
    
                  } else if (event.which === Hotkeys.DOWN || event.which === Hotkeys.UP) {
    
                    $$item[ event.which === Hotkeys.UP ? 'prev' : 'next' ]().focus();
    
                  }
    
              }
              
        };
    
        // static
        NavDropdown._isCollapsed = function(rootNode) {
            var match;
            if (rootNode.length) rootNode = rootNode[0];
            return rootNode && (match = /navbar-toggleable-(xs|sm|md|lg|xl)/.exec(rootNode.className))
                && (window.innerWidth < Breakpoints[ match[1].toUpperCase() ]);
        };
    
        // static
        NavDropdown._dataApiResizeHandler = function() {
    
            $(Selector.BASE).each(function(){
                
                var isCollapsed = NavDropdown._isCollapsed(this);
                
                $(this).find(Selector.DROPDOWN).removeClass(ClassName.OPEN);
                $(this).find('[aria-expanded="true"]').attr('aria-expanded', 'false');
    
                var backdrop = $(Selector.BACKDROP)[0];
                if (backdrop) {
                    backdrop.parentNode.removeChild(backdrop); // ???
                }
    
                if (isCollapsed == $(this).hasClass(ClassName.SM)) {
                    return;
                }
    
                if (isCollapsed) {
                    $(this).addClass(ClassName.SM);
                } else {
                    $(this).removeClass(ClassName.SM);
    
                    // $(this).removeClass(ClassName.SM + ' in'); /// ???
                    // NavDropdown._clearMenus();
                }
    
            });
        };
    
        /**
         * ------------------------------------------------------------------------
         * jQuery
         * ------------------------------------------------------------------------
         */
    
        $.fn[NAME] = function(config) {
            return this.each(function(){
                
                var data  = $(this).data(DATA_KEY);
    
                if (!data) {
                    $(this).data(DATA_KEY, (data = new NavDropdown(this)));
                }
    
                if (typeof config === 'string') {
                    if (data[config] === undefined) {
                        throw new Error('No method named "' + config + '"');
                    }
                    data[config].call(this);
                }
    
            });
        };
        $.fn[NAME].noConflict = function() {
            $.fn[NAME] = JQUERY_NO_CONFLICT;
            return this;
        };
        $.fn[NAME].Constructor = NavDropdown;
        $.fn[NAME].$$ = $$;
    
    
        $(window)
            .on(Event.RESIZE_DATA_API + ' ' + Event.LOAD_DATA_API, NavDropdown._dataApiResizeHandler);
    
        $(document)
            .on(Event.KEYDOWN_DATA_API, Selector.BASE,  NavDropdown._dataApiKeydownHandler)
            .on(Event.NAVBAR_COLLAPSE, NavDropdown._clearMenus)
            .on(Event.CLICK_DATA_API, NavDropdown._clearMenus)
            .on(Event.CLICK_DATA_API, Selector.DATA_TOGGLE, NavDropdown.prototype.toggle)
            .on(Event.CLICK_DATA_API, Selector.FORM_CHILD, function(e){
                e.stopPropagation();
            });
    
        $(window)
           .trigger(Event.READY);
    
    
    })(jQuery);

    jQuery(function($){

        var DATA_KEY = 'bs.navbar-dropdown';
        var EVENT_KEY = '.' + DATA_KEY;
        var DATA_API_KEY = '.data-api';
        
        var Event = {
            COLLAPSE: 'collapse' + EVENT_KEY,
            CLICK_DATA_API: 'click' + EVENT_KEY + DATA_API_KEY,
            SCROLL_DATA_API: 'scroll' + EVENT_KEY + DATA_API_KEY,
            RESIZE_DATA_API: 'resize' + EVENT_KEY + DATA_API_KEY,
            COLLAPSE_SHOW: 'show.bs.collapse',
            COLLAPSE_HIDE: 'hide.bs.collapse',
            DROPDOWN_COLLAPSE: 'collapse.bs.nav-dropdown'
        };
    
        var ClassName = {
            IN: 'in',
            OPENED: 'opened',
            BG_COLOR: 'bg-color',
            DROPDOWN_OPEN: 'navbar-dropdown-open',
            SHORT: 'navbar-short'
        };
    
        var Selector = {
            BODY: 'body',
            BASE: '.navbar-dropdown',
            TOGGLER: '.navbar-toggler[aria-expanded="true"]',
            TRANSPARENT: '.transparent',
            FIXED_TOP: '.navbar-fixed-top'
        };
    
        function _dataApiHandler(event) {
    
            if (event.type === 'resize') {
    
                $(Selector.BODY).removeClass(ClassName.DROPDOWN_OPEN);
                $(Selector.BASE).find(".navbar-collapse").removeClass("show");
                $(Selector.BASE)
                    .removeClass(ClassName.OPENED)
                    .find(Selector.TOGGLER).each(function(){
                        
                        $( $(this).attr('data-target') )
                            .removeClass(ClassName.IN)
                            .add(this)
                            .attr('aria-expanded', 'false');
    
                    });
    
            }
    
            var scrollTop = $(this).scrollTop();
            $(Selector.BASE).each(function(){
    
                if (!$(this).is(Selector.FIXED_TOP)) return;
    
                if ($(this).is(Selector.TRANSPARENT) && !$(this).hasClass(ClassName.OPENED)) {
    
                    if (scrollTop > 0) {
                        $(this).removeClass(ClassName.BG_COLOR);
                    } else {
                        $(this).addClass(ClassName.BG_COLOR);
                    }
    
                }
            
                if (scrollTop > 0) {
                    $(this).addClass(ClassName.SHORT);
                } else {
                    $(this).removeClass(ClassName.SHORT);
                }
    
            });
    
        }
    
        var _timeout;
        $(window)
            .on(Event.SCROLL_DATA_API + ' ' + Event.RESIZE_DATA_API, function(event){
                clearTimeout(_timeout);
                _timeout = setTimeout(function(){
                    _dataApiHandler(event);
                }, 10);
            })
            .trigger(Event.SCROLL_DATA_API);
    
        $(document)
            .on(Event.CLICK_DATA_API, Selector.BASE, function(event){
                event.targetWrapper = this;
            })
            .on(Event.COLLAPSE_SHOW + ' ' + Event.COLLAPSE_HIDE, function(event){
    
                $(event.target).closest(Selector.BASE).each(function(){
    
                    if (event.type == 'show') {
    
                        $(Selector.BODY).addClass(ClassName.DROPDOWN_OPEN);
    
                        $(this).addClass(ClassName.OPENED);
    
                    } else {
    
                        $(Selector.BODY).removeClass(ClassName.DROPDOWN_OPEN);
    
                        $(this).removeClass(ClassName.OPENED);
    
                        $(window).trigger(Event.SCROLL_DATA_API);
    
                        $(this).trigger(Event.COLLAPSE);
    
                    }
    
                });
    
            })
            .on(Event.DROPDOWN_COLLAPSE, function(event){
    
                $(event.relatedTarget)
                    .closest(Selector.BASE)
                    .find(Selector.TOGGLER)
                    .trigger('click');
    
            });
    
    });

/*!
 * The Final Countdown for jQuery v2.2.0 (http://hilios.github.io/jQuery.countdown/)
 * Copyright (c) 2016 Edson Hilios
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
!function(a){"use strict";"function"==typeof define&&define.amd?define(["jquery"],a):a(jQuery)}(function(a){"use strict";function b(a){if(a instanceof Date)return a;if(String(a).match(g))return String(a).match(/^[0-9]*$/)&&(a=Number(a)),String(a).match(/\-/)&&(a=String(a).replace(/\-/g,"/")),new Date(a);throw new Error("Couldn't cast `"+a+"` to a date object.")}function c(a){var b=a.toString().replace(/([.?*+^$[\]\\(){}|-])/g,"\\$1");return new RegExp(b)}function d(a){return function(b){var d=b.match(/%(-|!)?[A-Z]{1}(:[^;]+;)?/gi);if(d)for(var f=0,g=d.length;f<g;++f){var h=d[f].match(/%(-|!)?([a-zA-Z]{1})(:[^;]+;)?/),j=c(h[0]),k=h[1]||"",l=h[3]||"",m=null;h=h[2],i.hasOwnProperty(h)&&(m=i[h],m=Number(a[m])),null!==m&&("!"===k&&(m=e(l,m)),""===k&&m<10&&(m="0"+m.toString()),b=b.replace(j,m.toString()))}return b=b.replace(/%%/,"%")}}function e(a,b){var c="s",d="";return a&&(a=a.replace(/(:|;|\s)/gi,"").split(/\,/),1===a.length?c=a[0]:(d=a[0],c=a[1])),Math.abs(b)>1?c:d}var f=[],g=[],h={precision:100,elapse:!1,defer:!1};g.push(/^[0-9]*$/.source),g.push(/([0-9]{1,2}\/){2}[0-9]{4}( [0-9]{1,2}(:[0-9]{2}){2})?/.source),g.push(/[0-9]{4}([\/\-][0-9]{1,2}){2}( [0-9]{1,2}(:[0-9]{2}){2})?/.source),g=new RegExp(g.join("|"));var i={Y:"years",m:"months",n:"daysToMonth",d:"daysToWeek",w:"weeks",W:"weeksToMonth",H:"hours",M:"minutes",S:"seconds",D:"totalDays",I:"totalHours",N:"totalMinutes",T:"totalSeconds"},j=function(b,c,d){this.el=b,this.$el=a(b),this.interval=null,this.offset={},this.options=a.extend({},h),this.instanceNumber=f.length,f.push(this),this.$el.data("countdown-instance",this.instanceNumber),d&&("function"==typeof d?(this.$el.on("update.countdown",d),this.$el.on("stoped.countdown",d),this.$el.on("finish.countdown",d)):this.options=a.extend({},h,d)),this.setFinalDate(c),this.options.defer===!1&&this.start()};a.extend(j.prototype,{start:function(){null!==this.interval&&clearInterval(this.interval);var a=this;this.update(),this.interval=setInterval(function(){a.update.call(a)},this.options.precision)},stop:function(){clearInterval(this.interval),this.interval=null,this.dispatchEvent("stoped")},toggle:function(){this.interval?this.stop():this.start()},pause:function(){this.stop()},resume:function(){this.start()},remove:function(){this.stop.call(this),f[this.instanceNumber]=null,delete this.$el.data().countdownInstance},setFinalDate:function(a){this.finalDate=b(a)},update:function(){if(0===this.$el.closest("html").length)return void this.remove();var b,c=void 0!==a._data(this.el,"events"),d=new Date;b=this.finalDate.getTime()-d.getTime(),b=Math.ceil(b/1e3),b=!this.options.elapse&&b<0?0:Math.abs(b),this.totalSecsLeft!==b&&c&&(this.totalSecsLeft=b,this.elapsed=d>=this.finalDate,this.offset={seconds:this.totalSecsLeft%60,minutes:Math.floor(this.totalSecsLeft/60)%60,hours:Math.floor(this.totalSecsLeft/60/60)%24,days:Math.floor(this.totalSecsLeft/60/60/24)%7,daysToWeek:Math.floor(this.totalSecsLeft/60/60/24)%7,daysToMonth:Math.floor(this.totalSecsLeft/60/60/24%30.4368),weeks:Math.floor(this.totalSecsLeft/60/60/24/7),weeksToMonth:Math.floor(this.totalSecsLeft/60/60/24/7)%4,months:Math.floor(this.totalSecsLeft/60/60/24/30.4368),years:Math.abs(this.finalDate.getFullYear()-d.getFullYear()),totalDays:Math.floor(this.totalSecsLeft/60/60/24),totalHours:Math.floor(this.totalSecsLeft/60/60),totalMinutes:Math.floor(this.totalSecsLeft/60),totalSeconds:this.totalSecsLeft},this.options.elapse||0!==this.totalSecsLeft?this.dispatchEvent("update"):(this.stop(),this.dispatchEvent("finish")))},dispatchEvent:function(b){var c=a.Event(b+".countdown");c.finalDate=this.finalDate,c.elapsed=this.elapsed,c.offset=a.extend({},this.offset),c.strftime=d(this.offset),this.$el.trigger(c)}}),a.fn.countdown=function(){var b=Array.prototype.slice.call(arguments,0);return this.each(function(){var c=a(this).data("countdown-instance");if(void 0!==c){var d=f[c],e=b[0];j.prototype.hasOwnProperty(e)?d[e].apply(d,b.slice(1)):null===String(e).match(/^[$A-Z_][0-9A-Z_$]*$/i)?(d.setFinalDate.call(d,e),d.start()):a.error("Method %s does not exist on jQuery.countdown".replace(/\%s/gi,e))}else new j(this,b[0],b[1])})}});

// Mobirise Initialization
var isBuilder = $('html').hasClass('is-builder');
function initCountdown() {
    $(".countdown:not(.countdown-inited)").each(function() {
        $(this).addClass('countdown-inited').countdown($(this).attr('data-due-date'), function(event) {
            
            var $days = $(event.target).closest('.countdown-cont').find('div.daysCountdown').attr('title');
            var $hours = $(event.target).closest('.countdown-cont').find('div.hoursCountdown').attr('title');
            var $minutes = $(event.target).closest('.countdown-cont').find('div.minutesCountdown').attr('title');
            var $seconds = $(event.target).closest('.countdown-cont').find('div.secondsCountdown').attr('title');             
            $(this).html(
                event.strftime([
                    '<div class="row">',
                    '<div class="col-xs-3 col-sm-3 col-md-3">',
                    '<span class="number-wrap">',
                    '<span class="number display-2">%D</span>',
                    '<span mbr-text class="period display-7">',$days,'</span>',
                    '<span class="dot">:</span>',
                    '</span>',
                    '</div>',
                    '<div class="col-xs-3 col-sm-3 col-md-3">',
                    '<span class="number-wrap">',
                    '<span class="number display-2">%H</span>',
                    '<span mbr-text class="period display-7">',$hours,'</span>',
                    '<span class="dot">:</span>',
                    '</span>',
                    '</div>',
                    '<div class="col-xs-3 col-sm-3 col-md-3">',
                    '<span class="number-wrap">',
                    '<span class="number display-2">%M</span>',
                    '<span mbr-text class="period display-7">',$minutes,'</span>',
                    '<span class="dot">:</span>',
                    '</span>',
                    '</div>',
                    '<div class="col-xs-3 col-sm-3 col-md-3">',
                    '<span class="number-wrap">',
                    '<span class="number display-2">%S</span>',
                    '<span mbr-text class="period display-7">',$seconds,'</span>',
                    '</span>',
                    '</div>',
                    '</div>'
                ].join(''))
            );
        });
    });

    $(".countdown:not(.countdown-inited)").each(function() {
        $(this).countdown($(this).attr('data-due-date'), function(event) {
            $(this).text(
                event.strftime('%D days %H:%M:%S')
            );
        });
    });
};

function changeCountdown(card, value) {
    var $reg = /\d\d\d\d\/\d\d\/\d\d/g,
        $target = $(card).find('.countdown');
    if (value.search($reg) > -1) {
        $target.removeClass('countdown-inited');
        initCountdown();
    }
}

if (isBuilder) {
    $(document).on('add.cards', function(event) {
        if ($('.countdown').length != 0) {
            initCountdown();
        }
    }).on('changeParameter.cards', function(event, paramName, value) {
        if (paramName === 'countdown') {
            changeCountdown(event.target, value);
        }
    });;
} else {
    if ($('.countdown').length != 0) {
        initCountdown();
    };
}

var isBuilder = $('html').hasClass('is-builder');

if (!isBuilder) {
    if(typeof window.initPopupBtnPlugin === 'undefined'){
        window.initPopupBtnPlugin = true;
        $('section.popup-btn-cards .card-wrapper').each(function(index, el) {
            $(this).addClass('popup-btn');
        });        
    }
}

!function(t,e){"function"==typeof define&&define.amd?define(e):"object"==typeof exports?module.exports=e(require,exports,module):t.Tether=e()}(this,function(t,e,o){"use strict";function i(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function n(t){var e=getComputedStyle(t),o=e.position;if("fixed"===o)return t;for(var i=t;i=i.parentNode;){var n=void 0;try{n=getComputedStyle(i)}catch(r){}if("undefined"==typeof n||null===n)return i;var s=n,a=s.overflow,f=s.overflowX,h=s.overflowY;if(/(auto|scroll)/.test(a+h+f)&&("absolute"!==o||["relative","absolute","fixed"].indexOf(n.position)>=0))return i}return document.body}function r(t){var e=void 0;t===document?(e=document,t=document.documentElement):e=t.ownerDocument;var o=e.documentElement,i={},n=t.getBoundingClientRect();for(var r in n)i[r]=n[r];var s=x(e);return i.top-=s.top,i.left-=s.left,"undefined"==typeof i.width&&(i.width=document.body.scrollWidth-i.left-i.right),"undefined"==typeof i.height&&(i.height=document.body.scrollHeight-i.top-i.bottom),i.top=i.top-o.clientTop,i.left=i.left-o.clientLeft,i.right=e.body.clientWidth-i.width-i.left,i.bottom=e.body.clientHeight-i.height-i.top,i}function s(t){return t.offsetParent||document.documentElement}function a(){var t=document.createElement("div");t.style.width="100%",t.style.height="200px";var e=document.createElement("div");f(e.style,{position:"absolute",top:0,left:0,pointerEvents:"none",visibility:"hidden",width:"200px",height:"150px",overflow:"hidden"}),e.appendChild(t),document.body.appendChild(e);var o=t.offsetWidth;e.style.overflow="scroll";var i=t.offsetWidth;o===i&&(i=e.clientWidth),document.body.removeChild(e);var n=o-i;return{width:n,height:n}}function f(){var t=arguments.length<=0||void 0===arguments[0]?{}:arguments[0],e=[];return Array.prototype.push.apply(e,arguments),e.slice(1).forEach(function(e){if(e)for(var o in e)({}).hasOwnProperty.call(e,o)&&(t[o]=e[o])}),t}function h(t,e){if("undefined"!=typeof t.classList)e.split(" ").forEach(function(e){e.trim()&&t.classList.remove(e)});else{var o=new RegExp("(^| )"+e.split(" ").join("|")+"( |$)","gi"),i=u(t).replace(o," ");p(t,i)}}function l(t,e){if("undefined"!=typeof t.classList)e.split(" ").forEach(function(e){e.trim()&&t.classList.add(e)});else{h(t,e);var o=u(t)+(" "+e);p(t,o)}}function d(t,e){if("undefined"!=typeof t.classList)return t.classList.contains(e);var o=u(t);return new RegExp("(^| )"+e+"( |$)","gi").test(o)}function u(t){return t.className instanceof SVGAnimatedString?t.className.baseVal:t.className}function p(t,e){t.setAttribute("class",e)}function c(t,e,o){o.forEach(function(o){-1===e.indexOf(o)&&d(t,o)&&h(t,o)}),e.forEach(function(e){d(t,e)||l(t,e)})}function i(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function g(t,e){var o=arguments.length<=2||void 0===arguments[2]?1:arguments[2];return t+o>=e&&e>=t-o}function m(){return"undefined"!=typeof performance&&"undefined"!=typeof performance.now?performance.now():+new Date}function v(){for(var t={top:0,left:0},e=arguments.length,o=Array(e),i=0;e>i;i++)o[i]=arguments[i];return o.forEach(function(e){var o=e.top,i=e.left;"string"==typeof o&&(o=parseFloat(o,10)),"string"==typeof i&&(i=parseFloat(i,10)),t.top+=o,t.left+=i}),t}function y(t,e){return"string"==typeof t.left&&-1!==t.left.indexOf("%")&&(t.left=parseFloat(t.left,10)/100*e.width),"string"==typeof t.top&&-1!==t.top.indexOf("%")&&(t.top=parseFloat(t.top,10)/100*e.height),t}function b(t,e){return"scrollParent"===e?e=t.scrollParent:"window"===e&&(e=[pageXOffset,pageYOffset,innerWidth+pageXOffset,innerHeight+pageYOffset]),e===document&&(e=e.documentElement),"undefined"!=typeof e.nodeType&&!function(){var t=r(e),o=t,i=getComputedStyle(e);e=[o.left,o.top,t.width+o.left,t.height+o.top],U.forEach(function(t,o){t=t[0].toUpperCase()+t.substr(1),"Top"===t||"Left"===t?e[o]+=parseFloat(i["border"+t+"Width"]):e[o]-=parseFloat(i["border"+t+"Width"])})}(),e}var w=function(){function t(t,e){for(var o=0;o<e.length;o++){var i=e[o];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(t,i.key,i)}}return function(e,o,i){return o&&t(e.prototype,o),i&&t(e,i),e}}(),C=void 0;"undefined"==typeof C&&(C={modules:[]});var O=function(){var t=0;return function(){return++t}}(),E={},x=function(t){var e=t._tetherZeroElement;"undefined"==typeof e&&(e=t.createElement("div"),e.setAttribute("data-tether-id",O()),f(e.style,{top:0,left:0,position:"absolute"}),t.body.appendChild(e),t._tetherZeroElement=e);var o=e.getAttribute("data-tether-id");if("undefined"==typeof E[o]){E[o]={};var i=e.getBoundingClientRect();for(var n in i)E[o][n]=i[n];T(function(){delete E[o]})}return E[o]},A=[],T=function(t){A.push(t)},S=function(){for(var t=void 0;t=A.pop();)t()},W=function(){function t(){i(this,t)}return w(t,[{key:"on",value:function(t,e,o){var i=arguments.length<=3||void 0===arguments[3]?!1:arguments[3];"undefined"==typeof this.bindings&&(this.bindings={}),"undefined"==typeof this.bindings[t]&&(this.bindings[t]=[]),this.bindings[t].push({handler:e,ctx:o,once:i})}},{key:"once",value:function(t,e,o){this.on(t,e,o,!0)}},{key:"off",value:function(t,e){if("undefined"==typeof this.bindings||"undefined"==typeof this.bindings[t])if("undefined"==typeof e)delete this.bindings[t];else for(var o=0;o<this.bindings[t].length;)this.bindings[t][o].handler===e?this.bindings[t].splice(o,1):++o}},{key:"trigger",value:function(t){if("undefined"!=typeof this.bindings&&this.bindings[t]){for(var e=0,o=arguments.length,i=Array(o>1?o-1:0),n=1;o>n;n++)i[n-1]=arguments[n];for(;e<this.bindings[t].length;){var r=this.bindings[t][e],s=r.handler,a=r.ctx,f=r.once,h=a;"undefined"==typeof h&&(h=this),s.apply(h,i),f?this.bindings[t].splice(e,1):++e}}}}]),t}();C.Utils={getScrollParent:n,getBounds:r,getOffsetParent:s,extend:f,addClass:l,removeClass:h,hasClass:d,updateClasses:c,defer:T,flush:S,uniqueId:O,Evented:W,getScrollBarSize:a};var M=function(){function t(t,e){var o=[],i=!0,n=!1,r=void 0;try{for(var s,a=t[Symbol.iterator]();!(i=(s=a.next()).done)&&(o.push(s.value),!e||o.length!==e);i=!0);}catch(f){n=!0,r=f}finally{try{!i&&a["return"]&&a["return"]()}finally{if(n)throw r}}return o}return function(e,o){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return t(e,o);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),w=function(){function t(t,e){for(var o=0;o<e.length;o++){var i=e[o];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(t,i.key,i)}}return function(e,o,i){return o&&t(e.prototype,o),i&&t(e,i),e}}();if("undefined"==typeof C)throw new Error("You must include the utils.js file before tether.js");var P=C.Utils,n=P.getScrollParent,r=P.getBounds,s=P.getOffsetParent,f=P.extend,l=P.addClass,h=P.removeClass,c=P.updateClasses,T=P.defer,S=P.flush,a=P.getScrollBarSize,k=function(){if("undefined"==typeof document)return"";for(var t=document.createElement("div"),e=["transform","webkitTransform","OTransform","MozTransform","msTransform"],o=0;o<e.length;++o){var i=e[o];if(void 0!==t.style[i])return i}}(),B=[],_=function(){B.forEach(function(t){t.position(!1)}),S()};!function(){var t=null,e=null,o=null,i=function n(){return"undefined"!=typeof e&&e>16?(e=Math.min(e-16,250),void(o=setTimeout(n,250))):void("undefined"!=typeof t&&m()-t<10||("undefined"!=typeof o&&(clearTimeout(o),o=null),t=m(),_(),e=m()-t))};"undefined"!=typeof window&&["resize","scroll","touchmove"].forEach(function(t){window.addEventListener(t,i)})}();var z={center:"center",left:"right",right:"left"},F={middle:"middle",top:"bottom",bottom:"top"},L={top:0,left:0,middle:"50%",center:"50%",bottom:"100%",right:"100%"},Y=function(t,e){var o=t.left,i=t.top;return"auto"===o&&(o=z[e.left]),"auto"===i&&(i=F[e.top]),{left:o,top:i}},H=function(t){var e=t.left,o=t.top;return"undefined"!=typeof L[t.left]&&(e=L[t.left]),"undefined"!=typeof L[t.top]&&(o=L[t.top]),{left:e,top:o}},X=function(t){var e=t.split(" "),o=M(e,2),i=o[0],n=o[1];return{top:i,left:n}},j=X,N=function(){function t(e){var o=this;i(this,t),this.position=this.position.bind(this),B.push(this),this.history=[],this.setOptions(e,!1),C.modules.forEach(function(t){"undefined"!=typeof t.initialize&&t.initialize.call(o)}),this.position()}return w(t,[{key:"getClass",value:function(){var t=arguments.length<=0||void 0===arguments[0]?"":arguments[0],e=this.options.classes;return"undefined"!=typeof e&&e[t]?this.options.classes[t]:this.options.classPrefix?this.options.classPrefix+"-"+t:t}},{key:"setOptions",value:function(t){var e=this,o=arguments.length<=1||void 0===arguments[1]?!0:arguments[1],i={offset:"0 0",targetOffset:"0 0",targetAttachment:"auto auto",classPrefix:"tether"};this.options=f(i,t);var r=this.options,s=r.element,a=r.target,h=r.targetModifier;if(this.element=s,this.target=a,this.targetModifier=h,"viewport"===this.target?(this.target=document.body,this.targetModifier="visible"):"scroll-handle"===this.target&&(this.target=document.body,this.targetModifier="scroll-handle"),["element","target"].forEach(function(t){if("undefined"==typeof e[t])throw new Error("Tether Error: Both element and target must be defined");"undefined"!=typeof e[t].jquery?e[t]=e[t][0]:"string"==typeof e[t]&&(e[t]=document.querySelector(e[t]))}),l(this.element,this.getClass("element")),this.options.addTargetClasses!==!1&&l(this.target,this.getClass("target")),!this.options.attachment)throw new Error("Tether Error: You must provide an attachment");this.targetAttachment=j(this.options.targetAttachment),this.attachment=j(this.options.attachment),this.offset=X(this.options.offset),this.targetOffset=X(this.options.targetOffset),"undefined"!=typeof this.scrollParent&&this.disable(),"scroll-handle"===this.targetModifier?this.scrollParent=this.target:this.scrollParent=n(this.target),this.options.enabled!==!1&&this.enable(o)}},{key:"getTargetBounds",value:function(){if("undefined"==typeof this.targetModifier)return r(this.target);if("visible"===this.targetModifier){if(this.target===document.body)return{top:pageYOffset,left:pageXOffset,height:innerHeight,width:innerWidth};var t=r(this.target),e={height:t.height,width:t.width,top:t.top,left:t.left};return e.height=Math.min(e.height,t.height-(pageYOffset-t.top)),e.height=Math.min(e.height,t.height-(t.top+t.height-(pageYOffset+innerHeight))),e.height=Math.min(innerHeight,e.height),e.height-=2,e.width=Math.min(e.width,t.width-(pageXOffset-t.left)),e.width=Math.min(e.width,t.width-(t.left+t.width-(pageXOffset+innerWidth))),e.width=Math.min(innerWidth,e.width),e.width-=2,e.top<pageYOffset&&(e.top=pageYOffset),e.left<pageXOffset&&(e.left=pageXOffset),e}if("scroll-handle"===this.targetModifier){var t=void 0,o=this.target;o===document.body?(o=document.documentElement,t={left:pageXOffset,top:pageYOffset,height:innerHeight,width:innerWidth}):t=r(o);var i=getComputedStyle(o),n=o.scrollWidth>o.clientWidth||[i.overflow,i.overflowX].indexOf("scroll")>=0||this.target!==document.body,s=0;n&&(s=15);var a=t.height-parseFloat(i.borderTopWidth)-parseFloat(i.borderBottomWidth)-s,e={width:15,height:.975*a*(a/o.scrollHeight),left:t.left+t.width-parseFloat(i.borderLeftWidth)-15},f=0;408>a&&this.target===document.body&&(f=-11e-5*Math.pow(a,2)-.00727*a+22.58),this.target!==document.body&&(e.height=Math.max(e.height,24));var h=this.target.scrollTop/(o.scrollHeight-a);return e.top=h*(a-e.height-f)+t.top+parseFloat(i.borderTopWidth),this.target===document.body&&(e.height=Math.max(e.height,24)),e}}},{key:"clearCache",value:function(){this._cache={}}},{key:"cache",value:function(t,e){return"undefined"==typeof this._cache&&(this._cache={}),"undefined"==typeof this._cache[t]&&(this._cache[t]=e.call(this)),this._cache[t]}},{key:"enable",value:function(){var t=arguments.length<=0||void 0===arguments[0]?!0:arguments[0];this.options.addTargetClasses!==!1&&l(this.target,this.getClass("enabled")),l(this.element,this.getClass("enabled")),this.enabled=!0,this.scrollParent!==document&&this.scrollParent.addEventListener("scroll",this.position),t&&this.position()}},{key:"disable",value:function(){h(this.target,this.getClass("enabled")),h(this.element,this.getClass("enabled")),this.enabled=!1,"undefined"!=typeof this.scrollParent&&this.scrollParent.removeEventListener("scroll",this.position)}},{key:"destroy",value:function(){var t=this;this.disable(),B.forEach(function(e,o){return e===t?void B.splice(o,1):void 0})}},{key:"updateAttachClasses",value:function(t,e){var o=this;t=t||this.attachment,e=e||this.targetAttachment;var i=["left","top","bottom","right","middle","center"];"undefined"!=typeof this._addAttachClasses&&this._addAttachClasses.length&&this._addAttachClasses.splice(0,this._addAttachClasses.length),"undefined"==typeof this._addAttachClasses&&(this._addAttachClasses=[]);var n=this._addAttachClasses;t.top&&n.push(this.getClass("element-attached")+"-"+t.top),t.left&&n.push(this.getClass("element-attached")+"-"+t.left),e.top&&n.push(this.getClass("target-attached")+"-"+e.top),e.left&&n.push(this.getClass("target-attached")+"-"+e.left);var r=[];i.forEach(function(t){r.push(o.getClass("element-attached")+"-"+t),r.push(o.getClass("target-attached")+"-"+t)}),T(function(){"undefined"!=typeof o._addAttachClasses&&(c(o.element,o._addAttachClasses,r),o.options.addTargetClasses!==!1&&c(o.target,o._addAttachClasses,r),delete o._addAttachClasses)})}},{key:"position",value:function(){var t=this,e=arguments.length<=0||void 0===arguments[0]?!0:arguments[0];if(this.enabled){this.clearCache();var o=Y(this.targetAttachment,this.attachment);this.updateAttachClasses(this.attachment,o);var i=this.cache("element-bounds",function(){return r(t.element)}),n=i.width,f=i.height;if(0===n&&0===f&&"undefined"!=typeof this.lastSize){var h=this.lastSize;n=h.width,f=h.height}else this.lastSize={width:n,height:f};var l=this.cache("target-bounds",function(){return t.getTargetBounds()}),d=l,u=y(H(this.attachment),{width:n,height:f}),p=y(H(o),d),c=y(this.offset,{width:n,height:f}),g=y(this.targetOffset,d);u=v(u,c),p=v(p,g);for(var m=l.left+p.left-u.left,b=l.top+p.top-u.top,w=0;w<C.modules.length;++w){var O=C.modules[w],E=O.position.call(this,{left:m,top:b,targetAttachment:o,targetPos:l,elementPos:i,offset:u,targetOffset:p,manualOffset:c,manualTargetOffset:g,scrollbarSize:A,attachment:this.attachment});if(E===!1)return!1;"undefined"!=typeof E&&"object"==typeof E&&(b=E.top,m=E.left)}var x={page:{top:b,left:m},viewport:{top:b-pageYOffset,bottom:pageYOffset-b-f+innerHeight,left:m-pageXOffset,right:pageXOffset-m-n+innerWidth}},A=void 0;return document.body.scrollWidth>window.innerWidth&&(A=this.cache("scrollbar-size",a),x.viewport.bottom-=A.height),document.body.scrollHeight>window.innerHeight&&(A=this.cache("scrollbar-size",a),x.viewport.right-=A.width),(-1===["","static"].indexOf(document.body.style.position)||-1===["","static"].indexOf(document.body.parentElement.style.position))&&(x.page.bottom=document.body.scrollHeight-b-f,x.page.right=document.body.scrollWidth-m-n),"undefined"!=typeof this.options.optimizations&&this.options.optimizations.moveElement!==!1&&"undefined"==typeof this.targetModifier&&!function(){var e=t.cache("target-offsetparent",function(){return s(t.target)}),o=t.cache("target-offsetparent-bounds",function(){return r(e)}),i=getComputedStyle(e),n=o,a={};if(["Top","Left","Bottom","Right"].forEach(function(t){a[t.toLowerCase()]=parseFloat(i["border"+t+"Width"])}),o.right=document.body.scrollWidth-o.left-n.width+a.right,o.bottom=document.body.scrollHeight-o.top-n.height+a.bottom,x.page.top>=o.top+a.top&&x.page.bottom>=o.bottom&&x.page.left>=o.left+a.left&&x.page.right>=o.right){var f=e.scrollTop,h=e.scrollLeft;x.offset={top:x.page.top-o.top+f-a.top,left:x.page.left-o.left+h-a.left}}}(),this.move(x),this.history.unshift(x),this.history.length>3&&this.history.pop(),e&&S(),!0}}},{key:"move",value:function(t){var e=this;if("undefined"!=typeof this.element.parentNode){var o={};for(var i in t){o[i]={};for(var n in t[i]){for(var r=!1,a=0;a<this.history.length;++a){var h=this.history[a];if("undefined"!=typeof h[i]&&!g(h[i][n],t[i][n])){r=!0;break}}r||(o[i][n]=!0)}}var l={top:"",left:"",right:"",bottom:""},d=function(t,o){var i="undefined"!=typeof e.options.optimizations,n=i?e.options.optimizations.gpu:null;if(n!==!1){var r=void 0,s=void 0;t.top?(l.top=0,r=o.top):(l.bottom=0,r=-o.bottom),t.left?(l.left=0,s=o.left):(l.right=0,s=-o.right),l[k]="translateX("+Math.round(s)+"px) translateY("+Math.round(r)+"px)","msTransform"!==k&&(l[k]+=" translateZ(0)")}else t.top?l.top=o.top+"px":l.bottom=o.bottom+"px",t.left?l.left=o.left+"px":l.right=o.right+"px"},u=!1;if((o.page.top||o.page.bottom)&&(o.page.left||o.page.right)?(l.position="absolute",d(o.page,t.page)):(o.viewport.top||o.viewport.bottom)&&(o.viewport.left||o.viewport.right)?(l.position="fixed",d(o.viewport,t.viewport)):"undefined"!=typeof o.offset&&o.offset.top&&o.offset.left?!function(){l.position="absolute";var i=e.cache("target-offsetparent",function(){return s(e.target)});s(e.element)!==i&&T(function(){e.element.parentNode.removeChild(e.element),i.appendChild(e.element)}),d(o.offset,t.offset),u=!0}():(l.position="absolute",d({top:!0,left:!0},t.page)),!u){for(var p=!0,c=this.element.parentNode;c&&"BODY"!==c.tagName;){if("static"!==getComputedStyle(c).position){p=!1;break}c=c.parentNode}p||(this.element.parentNode.removeChild(this.element),document.body.appendChild(this.element))}var m={},v=!1;for(var n in l){var y=l[n],b=this.element.style[n];""!==b&&""!==y&&["top","left","bottom","right"].indexOf(n)>=0&&(b=parseFloat(b),y=parseFloat(y)),b!==y&&(v=!0,m[n]=y)}v&&T(function(){f(e.element.style,m)})}}}]),t}();N.modules=[],C.position=_;var R=f(N,C),M=function(){function t(t,e){var o=[],i=!0,n=!1,r=void 0;try{for(var s,a=t[Symbol.iterator]();!(i=(s=a.next()).done)&&(o.push(s.value),!e||o.length!==e);i=!0);}catch(f){n=!0,r=f}finally{try{!i&&a["return"]&&a["return"]()}finally{if(n)throw r}}return o}return function(e,o){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return t(e,o);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),P=C.Utils,r=P.getBounds,f=P.extend,c=P.updateClasses,T=P.defer,U=["left","top","right","bottom"];C.modules.push({position:function(t){var e=this,o=t.top,i=t.left,n=t.targetAttachment;if(!this.options.constraints)return!0;var s=this.cache("element-bounds",function(){return r(e.element)}),a=s.height,h=s.width;if(0===h&&0===a&&"undefined"!=typeof this.lastSize){var l=this.lastSize;h=l.width,a=l.height}var d=this.cache("target-bounds",function(){return e.getTargetBounds()}),u=d.height,p=d.width,g=[this.getClass("pinned"),this.getClass("out-of-bounds")];this.options.constraints.forEach(function(t){var e=t.outOfBoundsClass,o=t.pinnedClass;e&&g.push(e),o&&g.push(o)}),g.forEach(function(t){["left","top","right","bottom"].forEach(function(e){g.push(t+"-"+e)})});var m=[],v=f({},n),y=f({},this.attachment);return this.options.constraints.forEach(function(t){var r=t.to,s=t.attachment,f=t.pin;"undefined"==typeof s&&(s="");var l=void 0,d=void 0;if(s.indexOf(" ")>=0){var c=s.split(" "),g=M(c,2);d=g[0],l=g[1]}else l=d=s;var w=b(e,r);("target"===d||"both"===d)&&(o<w[1]&&"top"===v.top&&(o+=u,v.top="bottom"),o+a>w[3]&&"bottom"===v.top&&(o-=u,v.top="top")),"together"===d&&(o<w[1]&&"top"===v.top&&("bottom"===y.top?(o+=u,v.top="bottom",o+=a,y.top="top"):"top"===y.top&&(o+=u,v.top="bottom",o-=a,y.top="bottom")),o+a>w[3]&&"bottom"===v.top&&("top"===y.top?(o-=u,v.top="top",o-=a,y.top="bottom"):"bottom"===y.top&&(o-=u,v.top="top",o+=a,y.top="top")),"middle"===v.top&&(o+a>w[3]&&"top"===y.top?(o-=a,y.top="bottom"):o<w[1]&&"bottom"===y.top&&(o+=a,y.top="top"))),("target"===l||"both"===l)&&(i<w[0]&&"left"===v.left&&(i+=p,v.left="right"),i+h>w[2]&&"right"===v.left&&(i-=p,v.left="left")),"together"===l&&(i<w[0]&&"left"===v.left?"right"===y.left?(i+=p,v.left="right",i+=h,y.left="left"):"left"===y.left&&(i+=p,v.left="right",i-=h,y.left="right"):i+h>w[2]&&"right"===v.left?"left"===y.left?(i-=p,v.left="left",i-=h,y.left="right"):"right"===y.left&&(i-=p,v.left="left",i+=h,y.left="left"):"center"===v.left&&(i+h>w[2]&&"left"===y.left?(i-=h,y.left="right"):i<w[0]&&"right"===y.left&&(i+=h,y.left="left"))),("element"===d||"both"===d)&&(o<w[1]&&"bottom"===y.top&&(o+=a,y.top="top"),o+a>w[3]&&"top"===y.top&&(o-=a,y.top="bottom")),("element"===l||"both"===l)&&(i<w[0]&&"right"===y.left&&(i+=h,y.left="left"),i+h>w[2]&&"left"===y.left&&(i-=h,y.left="right")),"string"==typeof f?f=f.split(",").map(function(t){return t.trim()}):f===!0&&(f=["top","left","right","bottom"]),f=f||[];var C=[],O=[];o<w[1]&&(f.indexOf("top")>=0?(o=w[1],C.push("top")):O.push("top")),o+a>w[3]&&(f.indexOf("bottom")>=0?(o=w[3]-a,C.push("bottom")):O.push("bottom")),i<w[0]&&(f.indexOf("left")>=0?(i=w[0],C.push("left")):O.push("left")),i+h>w[2]&&(f.indexOf("right")>=0?(i=w[2]-h,C.push("right")):O.push("right")),C.length&&!function(){var t=void 0;t="undefined"!=typeof e.options.pinnedClass?e.options.pinnedClass:e.getClass("pinned"),m.push(t),C.forEach(function(e){m.push(t+"-"+e)})}(),O.length&&!function(){var t=void 0;t="undefined"!=typeof e.options.outOfBoundsClass?e.options.outOfBoundsClass:e.getClass("out-of-bounds"),m.push(t),O.forEach(function(e){m.push(t+"-"+e)})}(),(C.indexOf("left")>=0||C.indexOf("right")>=0)&&(y.left=v.left=!1),(C.indexOf("top")>=0||C.indexOf("bottom")>=0)&&(y.top=v.top=!1),(v.top!==n.top||v.left!==n.left||y.top!==e.attachment.top||y.left!==e.attachment.left)&&e.updateAttachClasses(y,v)}),T(function(){e.options.addTargetClasses!==!1&&c(e.target,m,g),c(e.element,m,g)}),{top:o,left:i}}});var P=C.Utils,r=P.getBounds,c=P.updateClasses,T=P.defer;C.modules.push({position:function(t){var e=this,o=t.top,i=t.left,n=this.cache("element-bounds",function(){return r(e.element)}),s=n.height,a=n.width,f=this.getTargetBounds(),h=o+s,l=i+a,d=[];o<=f.bottom&&h>=f.top&&["left","right"].forEach(function(t){var e=f[t];(e===i||e===l)&&d.push(t)}),i<=f.right&&l>=f.left&&["top","bottom"].forEach(function(t){var e=f[t];(e===o||e===h)&&d.push(t)});var u=[],p=[],g=["left","top","right","bottom"];return u.push(this.getClass("abutted")),g.forEach(function(t){u.push(e.getClass("abutted")+"-"+t)}),d.length&&p.push(this.getClass("abutted")),d.forEach(function(t){p.push(e.getClass("abutted")+"-"+t)}),T(function(){e.options.addTargetClasses!==!1&&c(e.target,p,u),c(e.element,p,u)}),!0}});var M=function(){function t(t,e){var o=[],i=!0,n=!1,r=void 0;try{for(var s,a=t[Symbol.iterator]();!(i=(s=a.next()).done)&&(o.push(s.value),!e||o.length!==e);i=!0);}catch(f){n=!0,r=f}finally{try{!i&&a["return"]&&a["return"]()}finally{if(n)throw r}}return o}return function(e,o){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return t(e,o);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}();return C.modules.push({position:function(t){var e=t.top,o=t.left;if(this.options.shift){var i=this.options.shift;"function"==typeof this.options.shift&&(i=this.options.shift.call(this,{top:e,left:o}));var n=void 0,r=void 0;if("string"==typeof i){i=i.split(" "),i[1]=i[1]||i[0];var s=i,a=M(s,2);n=a[0],r=a[1],n=parseFloat(n,10),r=parseFloat(r,10)}else n=i.top,r=i.left;return e+=n,o+=r,{top:e,left:o}}}}),R});

(function($) {
    var isBuilder = $('html').hasClass('is-builder');

    $.extend($.easing, {
        easeInOutCubic: function(x, t, b, c, d) {
            if ((t /= d / 2) < 1) return c / 2 * t * t * t + b;
            return c / 2 * ((t -= 2) * t * t + 2) + b;
        }
    });

    $.fn.outerFind = function(selector) {
        return this.find(selector).addBack(selector);
    };

    $.fn.scrollEnd = function(callback, timeout) {
        $(this).scroll(function(){
            var $this = $(this);
            if ($this.data('scrollTimeout')) {
                clearTimeout($this.data('scrollTimeout'));
            }
            $this.data('scrollTimeout', setTimeout(callback,timeout));
        });
    };

    $.fn.footerReveal = function() {
        var $this = $(this);
        var $prev = $this.prev();
        var $win = $(window);
        var isIE = !!document.documentMode;

        function initReveal() {
            if (!isIE && $this.outerHeight() <= $win.outerHeight()) {
                $this.css({
                    'z-index': -999,
                    position: 'fixed',
                    bottom: 0
                });

                $this.css({
                    'width': $prev.outerWidth()
                });

                $prev.css({
                    'margin-bottom': $this.outerHeight()
                });
            } else {
                $this.css({
                    'z-index': '',
                    position: '',
                    bottom: ''
                });

                $this.css({
                    'width': ''
                });

                $prev.css({
                    'margin-bottom': ''
                });
            }
        }

        initReveal();

        $win.on('load resize', function() {
            initReveal();
        });

        return this;
    };

    (function($, sr) {
        // debouncing function from John Hann
        // http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/
        var debounce = function(func, threshold, execAsap) {
            var timeout;

            return function debounced() {
                var obj = this,
                    args = arguments;

                function delayed() {
                    if (!execAsap) func.apply(obj, args);
                    timeout = null;
                }

                if (timeout) clearTimeout(timeout);
                else if (execAsap) func.apply(obj, args);

                timeout = setTimeout(delayed, threshold || 100);
            };
        };
        // smartresize
        jQuery.fn[sr] = function(fn) {
            return fn ? this.bind('resize', debounce(fn)) : this.trigger(sr);
        };

    })(jQuery, 'smartresize');

    (function() {

        var scrollbarWidth = 0,
            originalMargin, touchHandler = function(event) {
                event.preventDefault();
            };

        function getScrollbarWidth() {
            if (scrollbarWidth) return scrollbarWidth;
            var scrollDiv = document.createElement('div');
            $.each({
                top: '-9999px',
                width: '50px',
                height: '50px',
                overflow: 'scroll',
                position: 'absolute'
            }, function(property, value) {
                scrollDiv.style[property] = value;
            });
            $('body').append(scrollDiv);
            scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
            $('body')[0].removeChild(scrollDiv);
            return scrollbarWidth;
        }

    })();

    $.isMobile = function(type) {
        var reg = [];
        var any = {
            blackberry: 'BlackBerry',
            android: 'Android',
            windows: 'IEMobile',
            opera: 'Opera Mini',
            ios: 'iPhone|iPad|iPod'
        };
        type = 'undefined' == $.type(type) ? '*' : type.toLowerCase();
        if ('*' == type) reg = $.map(any, function(v) {
            return v;
        });
        else if (type in any) reg.push(any[type]);
        return !!(reg.length && navigator.userAgent.match(new RegExp(reg.join('|'), 'i')));
    };

    var isSupportViewportUnits = (function() {
        // modernizr implementation
        var $elem = $('<div style="height: 50vh; position: absolute; top: -1000px; left: -1000px;">').appendTo('body');
        var elem = $elem[0];
        var height = parseInt(window.innerHeight / 2, 10);
        var compStyle = parseInt((window.getComputedStyle ? getComputedStyle(elem, null) : elem.currentStyle)['height'], 10);
        $elem.remove();
        return compStyle == height;
    }());

    $(function() {

        $('html').addClass($.isMobile() ? 'mobile' : 'desktop');

        // .mbr-navbar--sticky
        $(window).scroll(function() {
            $('.mbr-navbar--sticky').each(function() {
                var method = $(window).scrollTop() > 10 ? 'addClass' : 'removeClass';
                $(this)[method]('mbr-navbar--stuck')
                    .not('.mbr-navbar--open')[method]('mbr-navbar--short');
            });
        });

        if ($.isMobile() && navigator.userAgent.match(/Chrome/i)) { // simple fix for Chrome's scrolling
            (function(width, height) {
                var deviceSize = [width, width];
                deviceSize[height > width ? 0 : 1] = height;
                $(window).smartresize(function() {
                    var windowHeight = $(window).height();
                    if ($.inArray(windowHeight, deviceSize) < 0)
                        windowHeight = deviceSize[$(window).width() > windowHeight ? 1 : 0];
                    $('.mbr-section--full-height').css('height', windowHeight + 'px');
                });
            })($(window).width(), $(window).height());
        } else if (!isSupportViewportUnits) { // fallback for .mbr-section--full-height
            $(window).smartresize(function() {
                $('.mbr-section--full-height').css('height', $(window).height() + 'px');
            });
            $(document).on('add.cards', function(event) {
                if ($('html').hasClass('mbr-site-loaded') && $(event.target).outerFind('.mbr-section--full-height').length)
                    $(window).resize();
            });
        }

        // .mbr-section--16by9 (16 by 9 blocks autoheight)
        function calculate16by9() {
            $(this).css('height', $(this).parent().width() * 9 / 16);
        }
        $(window).smartresize(function() {
            $('.mbr-section--16by9').each(calculate16by9);
        });
        $(document).on('add.cards changeParameter.cards', function(event) {
            var enabled = $(event.target).outerFind('.mbr-section--16by9');
            if (enabled.length) {
                enabled
                    .attr('data-16by9', 'true')
                    .each(calculate16by9);
            } else {
                $(event.target).outerFind('[data-16by9]')
                    .css('height', '')
                    .removeAttr('data-16by9');
            }
        });

        // .mbr-parallax-background
        function initParallax(card) {
            setTimeout(function() {
                $(card).outerFind('.mbr-parallax-background')
                    .jarallax({
                        speed: 0.6
                    })
                    .css('position', 'relative');
            }, 0);
        }

        function destroyParallax(card) {
            $(card).jarallax('destroy').css('position', '');
        }

        if ($.fn.jarallax && !$.isMobile()) {
            $(window).on('update.parallax', function(event) {
                setTimeout(function() {
                    var $jarallax = $('.mbr-parallax-background');

                    $jarallax.jarallax('coverImage');
                    $jarallax.jarallax('clipContainer');
                    $jarallax.jarallax('onScroll');
                }, 0);
            });

            if (isBuilder) {
                $(document).on('add.cards', function(event) {
                    initParallax(event.target);
                    $(window).trigger('update.parallax');
                });

                $(document).on('changeParameter.cards', function(event, paramName, value, key) {
                    if (paramName === 'bg') {
                        destroyParallax(event.target);

                        switch (key) {
                            case 'type':
                                if (value.parallax === true) {
                                    initParallax(event.target);
                                }
                                break;
                            case 'value':
                                if (value.type === 'image' && value.parallax === true) {
                                    initParallax(event.target);
                                }
                                break;
                            case 'parallax':
                                if (value.parallax === true) {
                                    initParallax(event.target);
                                }
                        }
                    }

                    $(window).trigger('update.parallax');
                });
            } else {
                initParallax(document.body);
            }

            // for Tabs
            $(window).on('shown.bs.tab', function(e) {
                $(window).trigger('update.parallax');
            });
        }

        // .mbr-fixed-top
        var fixedTopTimeout, scrollTimeout, prevScrollTop = 0,
            fixedTop = null,
            isDesktop = !$.isMobile();
        $(window).scroll(function() {
            if (scrollTimeout) clearTimeout(scrollTimeout);
            var scrollTop = $(window).scrollTop();
            var scrollUp = scrollTop <= prevScrollTop || isDesktop;
            prevScrollTop = scrollTop;
            if (fixedTop) {
                var fixed = scrollTop > fixedTop.breakPoint;
                if (scrollUp) {
                    if (fixed != fixedTop.fixed) {
                        if (isDesktop) {
                            fixedTop.fixed = fixed;
                            $(fixedTop.elm).toggleClass('is-fixed');
                        } else {
                            scrollTimeout = setTimeout(function() {
                                fixedTop.fixed = fixed;
                                $(fixedTop.elm).toggleClass('is-fixed');
                            }, 40);
                        }
                    }
                } else {
                    fixedTop.fixed = false;
                    $(fixedTop.elm).removeClass('is-fixed');
                }
            }
        });
        $(document).on('add.cards delete.cards', function(event) {
            if (fixedTopTimeout) clearTimeout(fixedTopTimeout);
            fixedTopTimeout = setTimeout(function() {
                if (fixedTop) {
                    fixedTop.fixed = false;
                    $(fixedTop.elm).removeClass('is-fixed');
                }
                $('.mbr-fixed-top:first').each(function() {
                    fixedTop = {
                        breakPoint: $(this).offset().top + $(this).height() * 3,
                        fixed: false,
                        elm: this
                    };
                    $(window).scroll();
                });
            }, 650);
        });

        // embedded videos
        $(window).smartresize(function() {
            $('.mbr-embedded-video').each(function() {
                $(this).height(
                    $(this).width() *
                    parseInt($(this).attr('height') || 315) /
                    parseInt($(this).attr('width') || 560)
                );
            });
        });
        $(document).on('add.cards', function(event) {
            if ($('html').hasClass('mbr-site-loaded') && $(event.target).outerFind('iframe').length)
                $(window).resize();
        });

        // background video
        function videoParser(card) {
            $(card).outerFind('[data-bg-video]').each(function() {
                var videoURL = $(this).attr('data-bg-video');
                var parsedUrl = videoURL.match(/(http:\/\/|https:\/\/|)?(player.|www.)?(vimeo\.com|youtu(be\.com|\.be|be\.googleapis\.com))\/(video\/|embed\/|watch\?v=|v\/)?([A-Za-z0-9._%-]*)(&\S+)?/);

                var $img = $('<div class="mbr-background-video-preview">')
                    .hide()
                    .css({
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    });
                $('> *:eq(0)', this).before($img);

                // youtube or vimeo
                if (parsedUrl && (/youtu\.?be/g.test(parsedUrl[3]) || /vimeo/g.test(parsedUrl[3]))) {
                    // youtube
                    if (parsedUrl && /youtu\.?be/g.test(parsedUrl[3])) {
                        var previewURL = 'http' + ('https:' === location.protocol ? 's' : '') + ':';
                        previewURL += '//img.youtube.com/vi/' + parsedUrl[6] + '/maxresdefault.jpg';

                        $('<img>').on('load', function() {
                            if (120 === (this.naturalWidth || this.width)) {
                                // selection of preview in the best quality
                                var file = this.src.split('/').pop();

                                switch (file) {
                                    case 'maxresdefault.jpg':
                                        this.src = this.src.replace(file, 'sddefault.jpg');
                                        break;
                                    case 'sddefault.jpg':
                                        this.src = this.src.replace(file, 'hqdefault.jpg');
                                        break;
                                    default: // image not found
                                        if (isBuilder) {
                                            $img.css('background-image', 'url("images/no-video.jpg")')
                                                .show();
                                        }
                                }
                            } else {
                                $img.css('background-image', 'url("' + this.src + '")')
                                    .show();
                            }
                        }).attr('src', previewURL);

                        if ($.fn.YTPlayer && !isBuilder && !$.isMobile()) {
                            $('> *:eq(1)', this).before('<div class="mbr-background-video"></div>').prev()
                                .YTPlayer({
                                    videoURL: parsedUrl[6],
                                    containment: 'self',
                                    showControls: false,
                                    mute: true
                                });
                        }
                    } else if (parsedUrl && /vimeo/g.test(parsedUrl[3])) { // vimeo
                        var request = new XMLHttpRequest();
                        request.open('GET', 'https://vimeo.com/api/v2/video/' + parsedUrl[6] + '.json', true);
                        request.onreadystatechange = function() {
                            if (this.readyState === 4) {
                                if (this.status >= 200 && this.status < 400) {
                                    var response = JSON.parse(this.responseText);

                                    $img.css('background-image', 'url("' + response[0].thumbnail_large + '")')
                                        .show();
                                } else if (isBuilder) { // image not found
                                    $img.css('background-image', 'url("images/no-video.jpg")')
                                        .show();
                                }
                            }
                        };
                        request.send();
                        request = null;

                        if ($.fn.vimeo_player && !isBuilder && !$.isMobile()) {
                            $('> *:eq(1)', this).before('<div class="mbr-background-video"></div>').prev()
                                .vimeo_player({
                                    videoURL: videoURL,
                                    containment: 'self',
                                    showControls: false,
                                    mute: true
                                });
                        }
                    }
                } else if (isBuilder) { // neither youtube nor vimeo
                    $img.css('background-image', 'url("images/video-placeholder.jpg")')
                        .show();
                }
            });
        }

        if (isBuilder) {
            $(document).on('add.cards', function(event) {
                videoParser(event.target);
            });
        } else {
            videoParser(document.body);
        }

        $(document).on('changeParameter.cards', function(event, paramName, value, key) {
            if (paramName === 'bg') {
                switch (key) {
                    case 'type':
                        $(event.target).find('.mbr-background-video-preview').remove();
                        if (value.type === 'video') {
                            videoParser(event.target);
                        }
                        break;
                    case 'value':
                        if (value.type === 'video') {
                            $(event.target).find('.mbr-background-video-preview').remove();
                            videoParser(event.target);
                        }
                        break;
                }
            }
        });

        // init
        if (!isBuilder) {
            $('body > *:not(style, script)').trigger('add.cards');
        }
        $('html').addClass('mbr-site-loaded');
        $(window).resize().scroll();

        // smooth scroll
        if (!isBuilder) {
            $(document).click(function(e) {
                try {
                    var target = e.target;

                    if ($(target).parents().hasClass('carousel')) {
                        return;
                    }
                    do {
                        if (target.hash) {
                            var useBody = /#bottom|#top/g.test(target.hash);
                            $(useBody ? 'body' : target.hash).each(function() {
                                e.preventDefault();
                                // in css sticky navbar has height 64px
                                // var stickyMenuHeight = $('.mbr-navbar--sticky').length ? 64 : 0;
                                var stickyMenuHeight = $(target).parents().hasClass('navbar-fixed-top') ? 60 : 0;
                                var goTo = target.hash == '#bottom' ? ($(this).height() - $(window).height()) : ($(this).offset().top - stickyMenuHeight);
                                // Disable Accordion's and Tab's scroll
                                if ($(this).hasClass('panel-collapse') || $(this).hasClass('tab-pane')) {
                                    return;
                                }
                                $('html, body').stop().animate({
                                    scrollTop: goTo
                                }, 800, 'easeInOutCubic');
                            });
                            break;
                        }
                    } while (target = target.parentNode);
                } catch (e) {
                    // throw e;
                }
            });
        }

        // init the same height columns
        $('.cols-same-height .mbr-figure').each(function() {
            var $imageCont = $(this);
            var $img = $imageCont.children('img');
            var $cont = $imageCont.parent();
            var imgW = $img[0].width;
            var imgH = $img[0].height;

            function setNewSize() {
                $img.css({
                    width: '',
                    maxWidth: '',
                    marginLeft: ''
                });

                if (imgH && imgW) {
                    var aspectRatio = imgH / imgW;

                    $imageCont.addClass({
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0
                    });

                    // change image size
                    var contAspectRatio = $cont.height() / $cont.width();
                    if (contAspectRatio > aspectRatio) {
                        var percent = 100 * (contAspectRatio - aspectRatio) / aspectRatio;
                        $img.css({
                            width: percent + 100 + '%',
                            maxWidth: percent + 100 + '%',
                            marginLeft: (-percent / 2) + '%'
                        });
                    }
                }
            }

            $img.one('load', function() {
                imgW = $img[0].width;
                imgH = $img[0].height;
                setNewSize();
            });

            $(window).on('resize', setNewSize);
            setNewSize();
        });
    });


    if (!isBuilder) {
        // .mbr-social-likes
        if ($.fn.socialLikes) {
            $(document).on('add.cards', function(event) {
                $(event.target).outerFind('.mbr-social-likes').on('counter.social-likes', function(event, service, counter) {
                    if (counter > 999) $('.social-likes__counter', event.target).html(Math.floor(counter / 1000) + 'k');
                }).socialLikes({
                    initHtml: false
                });
            });
        }

        $(document).on('add.cards', function(event) {
            if ($(event.target).hasClass('mbr-reveal')) {
                $(event.target).footerReveal();
            }
        });

        $(document).ready(function() {
            // disable animation on scroll on mobiles
            if ($.isMobile()) {
                return;
                // enable animation on scroll
            } else if ($('input[name=animation]').length) {
                $('input[name=animation]').remove();

                var $animatedElements = $('p, h1, h2, h3, h4, h5, a, button, small, img, li, blockquote, .mbr-author-name, em, label, input, select, textarea, .input-group, .form-control, .iconbox, .btn-social, .mbr-figure, .mbr-map, .mbr-testimonial .card-block, .mbr-price-value, .mbr-price-figure, .dataTable, .dataTables_info')
                    .not(function() {
                        return $(this).parents().is('a, p, .navbar, .mbr-arrow, footer, .iconbox, .mbr-slider, .mbr-gallery, .mbr-testimonial .card-block, #cookiesdirective, .mbr-wowslider, .accordion, .tab-content, .engine, #scrollToTop');
                    })
                    .not(function(){
                        return $(this).parents().is('form') && $(this).is('li')
                    }).addClass('hidden animated');

                function getElementOffset(element) {
                    var top = 0;
                    do {
                        top += element.offsetTop || 0;
                        element = element.offsetParent;
                    } while (element);

                    return top;
                }

                function elCarouselItem(element) {
                    if (element.parents('.carousel-item').css('display') !== 'none') return false;
                    var parentEl = element.parents('.carousel-item').parent();
                    if (parentEl.find('.carousel-item.active .hidden.animated').lenght){
                        return false;
                    }
                    else if (parentEl.attr('data-visible') > 1){
                        var visibleSlides = parentEl.attr('data-visible');
                        if (element.parents().is('.cloneditem-' + (visibleSlides - 1)) && element.parents('.cloneditem-' + (visibleSlides - 1)).attr('data-cloned-index') >= visibleSlides){
                            return true;
                        }
                        else{
                            element.removeClass('animated hidden');
                            return false;
                        }
                    }
                    else return true;
                }

                function checkIfInView() {
                    var window_height = window.innerHeight;
                    var window_top_position = document.documentElement.scrollTop || document.body.scrollTop;
                    var window_bottom_position = window_top_position + window_height - 50;

                    $.each($animatedElements, function() {
                        var $element = $(this);
                        var element = $element[0];
                        var element_height = element.offsetHeight;
                        var element_top_position = getElementOffset(element);
                        var element_bottom_position = (element_top_position + element_height);

                        // check to see if this current element is within viewport
                        if ((((element_bottom_position >= window_top_position) &&
                            (element_top_position <= window_bottom_position)) || elCarouselItem($element)) &&
                            ($element.hasClass('hidden'))) {
                            $element.removeClass('hidden').addClass('fadeInUp')
                                .one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
                                    $element.removeClass('animated fadeInUp');
                                });
                        }
                    });
                }

                var $window = $(window);
                $window.on('scroll resize', checkIfInView);
                $window.trigger('scroll');
            }
        });

        if ($('.nav-dropdown').length) {
            $(".nav-dropdown").swipe({
                swipeLeft: function(event, direction, distance, duration, fingerCount) {
                    $('.navbar-close').click();
                }
            });
        }
    }

    // Scroll to Top Button
    $(document).ready(function() {
        if ($('.mbr-arrow-up').length) {
            var $scroller = $('#scrollToTop'),
                $main = $('body,html'),
                $window = $(window);
            $scroller.css('display', 'none');
            $window.scroll(function() {
                if ($(this).scrollTop() > 0) {
                    $scroller.fadeIn();
                } else {
                    $scroller.fadeOut();
                }
            });
            $scroller.click(function() {
                $main.animate({
                    scrollTop: 0
                }, 400);
                return false;
            });
        }
    });

    // arrow down
    if (!isBuilder) {
        $('.mbr-arrow').on('click', function(e) {
            var $next = $(e.target).closest('section').next();
            if($next.hasClass('engine')){
                $next = $next.closest('section').next();
            }
            var offset = $next.offset();
            $('html, body').stop().animate({
                scrollTop: offset.top
            }, 800, 'linear');
        });
    }

    // add padding to the first element, if it exists
    if ($('nav.navbar').length) {
        var navHeight = $('nav.navbar').height();
        $('.mbr-after-navbar.mbr-fullscreen').css('padding-top', navHeight + 'px');
    }

    function isIE() {
        var ua = window.navigator.userAgent;
        var msie = ua.indexOf("MSIE ");

        if (msie > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./)) {
            return true;
        }

        return false;
    }

    // fixes for IE
    if (!isBuilder && isIE()) {
        $(document).on('add.cards', function(event) {
            var $eventTarget = $(event.target);

            if ($eventTarget.hasClass('mbr-fullscreen')) {
                $(window).on('load resize', function() {
                    $eventTarget.css('height', 'auto');

                    if ($eventTarget.outerHeight() <= $(window).height()) {
                        $eventTarget.css('height', '1px');
                    }
                });
            }

            if ($eventTarget.hasClass('mbr-slider') || $eventTarget.hasClass('mbr-gallery')) {
                $eventTarget.find('.carousel-indicators').addClass('ie-fix').find('li').css({
                    display: 'inline-block',
                    width: '30px'
                });

                if ($eventTarget.hasClass('mbr-slider')) {
                    $eventTarget.find('.full-screen .slider-fullscreen-image').css('height', '1px');
                }
            }
        });
    }

    // Script for popUp video
    $(document).ready(function() {
        if (!isBuilder) {
            var modal = function(item) {
                var videoIframe = $(item).parents('section').find('iframe')[0],
                    videoIframeSrc = $(videoIframe).attr('src');

                item.parents('section').css('z-index', '5000');

                if (videoIframeSrc.indexOf('youtu') !== -1) {
                    videoIframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                }

                if (videoIframeSrc.indexOf('vimeo') !== -1) {
                    var vimeoPlayer = new Vimeo.Player($(videoIframe));
                    vimeoPlayer.play();
                }

                $(item).parents('section').find($(item).attr('data-modal'))
                    .css('display', 'table')
                    .click(function() {
                        if (videoIframeSrc.indexOf('youtu') !== -1) {
                            videoIframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                        }

                        if (videoIframeSrc.indexOf('vimeo') !== -1) {
                            vimeoPlayer.pause();
                        }

                        $(this).css('display', 'none').off('click');
                        item.parents('section').css('z-index', '0');
                    });
            };

            // Youtube & Vimeo
            $('.modalWindow-video iframe').each(function() {
                var videoURL = $(this).attr('data-src');
                $(this).removeAttr('data-src');

                var parsedUrl = videoURL.match(/(http:\/\/|https:\/\/|)?(player.|www.)?(vimeo\.com|youtu(be\.com|\.be|be\.googleapis\.com))\/(video\/|embed\/|watch\?v=|v\/)?([A-Za-z0-9._%-]*)(&\S+)?/);
                if (videoURL.indexOf('youtu') !== -1) {
                    $(this).attr('src', 'https://youtube.com/embed/' + parsedUrl[6] + '?rel=0&enablejsapi=1');
                } else if (videoURL.indexOf('vimeo') !== -1) {
                    $(this).attr('src', 'https://player.vimeo.com/video/' + parsedUrl[6] + '?autoplay=0&loop=0');
                }
            });

            $('[data-modal]').click(function() {
                modal($(this));
            });
        }
    });

    if (!isBuilder) {
        // open dropdown menu on hover
        if (!$.isMobile()) {
            var $menu = $('section.menu'),
                $width = $(window).width(),
                $collapsed = $menu.find('.navbar').hasClass('collapsed');
            // check if collapsed on
            if (!$collapsed ){
                // check width device
                if ($width > 991) {
                    $menu.find('ul.navbar-nav li.dropdown').hover(
                        function() {
                            if (!$(this).hasClass('open')) {
                                $(this).find('a')[0].click();
                            }
                        },
                        function() {
                            if ($(this).hasClass('open')) {
                                $(this).find('a')[0].click();
                            }
                        }
                    );
                    $menu.find('ul.navbar-nav li.dropdown .dropdown-menu .dropdown').hover(
                        function() {
                            if (!$(this).hasClass('open')) {
                                $(this).find('a')[0].click();
                            }
                        },
                        function() {
                            if ($(this).hasClass('open')) {
                                $(this).find('a')[0].click();
                            }
                        }
                    );
                }
            }    
        }
    }

    // Functions from plugins for
    // compatible with old projects 
    function setActiveCarouselItem(card){
    var $target = $(card).find('.carousel-item:first');
    $target.addClass('active');
    }
    function initTestimonialsCarousel(card){
        var $target = $(card),
            $carouselID = $target.attr('ID') +"-carousel"; 
        $target.find('.carousel').attr('id',$carouselID);
        $target.find('.carousel-controls a').attr('href','#'+$carouselID);
        $target.find('.carousel-indicators li').attr('data-target','#'+$carouselID);
        setActiveCarouselItem($target);  
    }
    function initClientCarousel(card){
        var $target = $(card),
        countElems = $target.find('.carousel-item').length,
        visibleSlides = $target.find('.carousel-inner').attr('data-visible');
        if (countElems < visibleSlides){
            visibleSlides = countElems;
        }
        $target.find('.carousel-inner').attr('class', 'carousel-inner slides' + visibleSlides);
        $target.find('.clonedCol').remove();

        $target.find('.carousel-item .col-md-12').each(function() {
            if (visibleSlides < 2) {
                $(this).attr('class', 'col-md-12');
            } else if (visibleSlides == '5') {
                $(this).attr('class', 'col-md-12 col-lg-15');
            } else {
                $(this).attr('class', 'col-md-12 col-lg-' + 12 / visibleSlides);
            }
        });

        $target.find('.carousel-item').each(function() {
            var itemToClone = $(this);
            for (var i = 1; i < visibleSlides; i++) {
                itemToClone = itemToClone.next();
                if (!itemToClone.length) {
                    itemToClone = $(this).siblings(':first');
                }
                var index = itemToClone.index();
                itemToClone.find('.col-md-12:first').clone().addClass('cloneditem-' + i).addClass('clonedCol').attr('data-cloned-index', index).appendTo($(this).children().eq(0));
            }
        });
    }
    function updateClientCarousel(card){
        var $target = $(card),
            countElems = $target.find('.carousel-item').length,
            visibleSlides = $target.find('.carousel-inner').attr('data-visible');
        if (countElems < visibleSlides){
            visibleSlides = countElems;
        }
        $target.find('.clonedCol').remove();
        $target.find('.carousel-item').each(function() {
            var itemToClone = $(this);
            for (var i = 1; i < visibleSlides; i++) {
                itemToClone = itemToClone.next();
                if (!itemToClone.length) {
                    itemToClone = $(this).siblings(':first');
                }
                var index = itemToClone.index();
                itemToClone.find('.col-md-12:first').clone().addClass('cloneditem-' + i).addClass('clonedCol').attr('data-cloned-index', index).appendTo($(this).children().eq(0));
            }
        });
    }
    function clickHandler(e){
        e.stopPropagation();
        e.preventDefault();

        var $target = $(e.target);
        var curItem;
        var curIndex;

        if ($target.closest('.clonedCol').length) {
            curItem = $target.closest('.clonedCol');
            curIndex = curItem.attr('data-cloned-index');
        } else {
            curItem = $target.closest('.carousel-item');
            curIndex = curItem.index();
        }
        var item = $($target.closest('.carousel-inner').find('.carousel-item')[curIndex]).find('img')[0];
                        
        if ($target.parents('.clonedCol').length > 0) {
            item.click();
        }
    }
    $.fn.outerFind = function(selector) {
        return this.find(selector).addBack(selector);
    };
    function initTabs(target) {
        if ($(target).find('.nav-tabs').length !== 0) {
            $(target).outerFind('section[id^="tabs"]').each(function() {
                var componentID = $(this).attr('id');
                var $tabsNavItem = $(this).find('.nav-tabs .nav-item');
                var $tabPane = $(this).find('.tab-pane');

                $tabPane.removeClass('active').eq(0).addClass('active');

                $tabsNavItem.find('a').removeClass('active').removeAttr('aria-expanded')
                    .eq(0).addClass('active');

                $tabPane.each(function() {
                    $(this).attr('id', componentID + '_tab' + $(this).index());
                });

                $tabsNavItem.each(function() {
                    $(this).find('a').attr('href', '#' + componentID + '_tab' + $(this).index());
                });
            });
        }
    }
    function clickPrev(event){
        event.stopPropagation();
        event.preventDefault();
    }
    if(!isBuilder){
        if(typeof window.initClientPlugin ==='undefined'){
            if($(document.body).find('.clients').length!=0){
                window.initClientPlugin = true;
                $(document.body).find('.clients').each(function(index, el) {
                    if(!$(this).attr('data-isinit')){
                        initTestimonialsCarousel($(this));
                        initClientCarousel($(this));
                    }  
                });  
            } 
        }
        if(typeof window.initPopupBtnPlugin === 'undefined'){
            if($(document.body).find('section.popup-btn-cards').length!=0){
                window.initPopupBtnPlugin = true;
                $('section.popup-btn-cards .card-wrapper').each(function(index, el) {
                    $(this).addClass('popup-btn');
                }); 
            }      
        }
        if(typeof window.initTestimonialsPlugin === 'undefined'){
            if($(document.body).find('.testimonials-slider').length!=0){
                window.initTestimonialsPlugin = true;
                $('.testimonials-slider').each(function(){
                    initTestimonialsCarousel(this);
                }); 
            }      
        }
        if (typeof window.initSwitchArrowPlugin === 'undefined'){
            window.initSwitchArrowPlugin = true;
            $(document).ready(function() {
                if ($('.accordionStyles').length!=0) {
                        $('.accordionStyles .card-header a[role="button"]').each(function(){
                            if(!$(this).hasClass('collapsed')){
                                $(this).addClass('collapsed');
                            }
                        });
                    }
            });
            $('.accordionStyles .card-header a[role="button"]').click(function(){
                var $id = $(this).closest('.accordionStyles').attr('id'),
                    $iscollapsing = $(this).closest('.card').find('.panel-collapse');
                if (!$iscollapsing.hasClass('collapsing')) {
                    if ($id.indexOf('toggle') != -1){
                        if ($(this).hasClass('collapsed')) {
                            $(this).find('span.sign').removeClass('mbri-arrow-down').addClass('mbri-arrow-up'); 
                        }
                        else{
                            $(this).find('span.sign').removeClass('mbri-arrow-up').addClass('mbri-arrow-down'); 
                        }
                    }
                    else if ($id.indexOf('accordion')!=-1) {
                        var $accordion =  $(this).closest('.accordionStyles ');
                    
                        $accordion.children('.card').each(function() {
                            $(this).find('span.sign').removeClass('mbri-arrow-up').addClass('mbri-arrow-down'); 
                        });
                        if ($(this).hasClass('collapsed')) {
                            $(this).find('span.sign').removeClass('mbri-arrow-down').addClass('mbri-arrow-up'); 
                        }
                    }
                }
            });
        }
        if(typeof window.initTabsPlugin === 'undefined'){
            window.initTabsPlugin = true;
            initTabs(document.body);
        }
        
        // Fix for slider bug
        if($('.mbr-slider.carousel').length!=0){
            $('.mbr-slider.carousel').each(function(){
                var $slider = $(this),
                    controls = $slider.find('.carousel-control'),
                    indicators = $slider.find('.carousel-indicators li');
                $slider.on('slide.bs.carousel', function () {
                    controls.bind('click',function(event){
                        clickPrev(event);
                    });
                    indicators.bind('click',function(event){
                        clickPrev(event);
                    })
                    $slider.carousel({
                        keyboard:false
                    });
                }).on('slid.bs.carousel',function(){
                    controls.unbind('click');
                    indicators.unbind('click');
                    $slider.carousel({
                        keyboard:true
                    });
                    if($slider.find('.carousel-item.active').length>1){
                        $slider.find('.carousel-item.active').eq(1).removeClass('active');
                        $slider.find('.carousel-control li.active').eq(1).removeClass('active');
                    }
                });
            });
        }
    }
    // Form Styler
    if (isBuilder) {
        $(document).on('add.cards', function (event) {
            if ($(event.target).find('.form-with-styler').length) {

                var form = $(event.target).find('.form-with-styler');

                $(form).find('select:not("[multiple]")').each(function () {
                    $(this).styler();
                });
                $(form).find('input[type=number]').each(function () {
                    $(this).styler();
                    $(this).parent().parent().removeClass('form-control')
                });
                // documentation about plugin https://xdsoft.net/jqplugins/datetimepicker/
                $(form).find('input[type=date]').each(function () {
                    if($(this).datetimepicker)
                        $(this).datetimepicker({
                            format: 'Y-m-d',
                            timepicker: false
                        });
                });
                $(form).find('input[type=time]').each(function () {
                    if($(this).datetimepicker)
                        $(this).datetimepicker({
                            format: 'H:i',
                            datepicker: false
                        });
                });

            }
        });
    } else {
        function detectmob() {
            if (navigator.userAgent.match(/Android/i)
                || navigator.userAgent.match(/webOS/i)
                || navigator.userAgent.match(/iPhone/i)
                || navigator.userAgent.match(/iPad/i)
                || navigator.userAgent.match(/iPod/i)
                || navigator.userAgent.match(/BlackBerry/i)
                || navigator.userAgent.match(/Windows Phone/i)
                || navigator.userAgent.match(/Firefox/i)
            ) {
                return true;
            }
            else {
                return false;
            }
        }

        $('section .form-with-styler').each(function () {
            $(this).find('select:not("[multiple]")').each(function () {
                $(this).hide();
                $(this).styler();
            });
            $(this).find('input[type=number]').each(function () {
                $(this).styler();
                $(this).parent().parent().removeClass('form-control')
            });
            if (!detectmob() && $(this).datetimepicker) {
                $(this).find('input[type=date]').each(function () {
                    $(this).datetimepicker({
                        format: 'Y-m-d',
                        timepicker: false
                    });
                });
                $(this).find('input[type=time]').each(function () {
                    $(this).datetimepicker({
                        format: 'H:i',
                        datepicker: false
                    });
                });
            }
        });
    }

    $(document).on('change', 'input[type="range"]', function(e){
        $(e.target).parents('.form-group').find('.value')[0].innerHTML = e.target.value;
    });
}(jQuery));
!function(){try{document.getElementsByClassName("engine")[0].getElementsByTagName("a")[0].removeAttribute("rel")}catch(b){}if(!document.getElementById("top-1")){var a=document.createElement("section");a.id="top-1";a.className="engine";a.innerHTML='<a href="https://mobirise.ws">Mobirise Website Builder</a> v4.12.4';document.body.insertBefore(a,document.body.childNodes[0])}}();
