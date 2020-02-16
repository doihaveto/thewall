var svgc, odoc, svg, srect;
var down, dsx, dsy;
var touch_diff = -1;
var articles;
var is_ff;
var zoom_scale = 0.15;
var zoom_scale_ff = 0.05;

document.addEventListener('readystatechange', function(e) {
    if (e.target.readyState !== 'complete')
        return;
    svgc = document.querySelector('object');
    odoc = svgc.contentDocument;
    svg = odoc.querySelector('svg');
    is_ff = !('getEnclosureList' in svg);
    if (is_ff)
        zoom_scale = zoom_scale_ff;
    svg.setAttribute('preserveAspectRatio', 'xMinYMin');
    srect = svg.createSVGRect();
    [srect.x, srect.y, srect.width, srect.height] = svg.getAttribute('viewBox').split(' ');
    let aspect_ratio = srect.width / srect.height;
    let crect = svg.getBoundingClientRect();
    if (crect.width / crect.height > aspect_ratio) {
        let nx = (srect.width - (crect.height * aspect_ratio)) / 2 - (srect.height / crect.height) / crect.width;
        svg.setAttribute('viewBox', `-${nx} ${srect.y} ${srect.width} ${srect.height}`);
    }
    odoc.addEventListener('wheel', svg_mouse_wheel_event);
    odoc.addEventListener('mousedown', svg_mouse_down_event);
    odoc.addEventListener('mouseup', svg_mouse_up_event);
    odoc.addEventListener('mousemove', svg_mouse_move_event);
    odoc.addEventListener('pointerleave', svg_mouse_leave_event);
    odoc.addEventListener('touchmove', svg_touch_move_event);
    odoc.addEventListener('touchstart', svg_touch_start_event);
    [...odoc.querySelectorAll('a')].forEach(anchor => { anchor.addEventListener('click', svg_a_click); });
    articles = [... $(svg).find('a[title]').map((i, el) => { return [[el.attributes.title.value, el.attributes.href.value, el]]; })].reduce((articles, t) => { articles[t[0]] = {url: t[1], node: t[2]}; return articles; }, {});
    let titles = [...new Set(Object.values(articles).map(tdata => decodeURIComponent(tdata.url.split('/').pop().replace(/\+/g, ' ').replace(/_/g, ' '))))];
    for (let i = 0, j = titles.length; i < j; i += 50) {
        var temp_titles = titles.slice(i, i + 50).join('|');
        $.ajax({
            url: 'https://theportal.wiki/api.php',
            jsonp: 'callback',
            dataType: 'jsonp',
            data: {
                action: 'query',
                format: 'json',
                prop: 'extracts|info',
                list: '',
                titles: temp_titles,
                utf8: '1',
                exintro: '1',
                exsectionformat: 'wiki',
                inprop: 'url',
            },
            success: function(response) {
                for (let k in response.query.pages) {
                    let pdata = response.query.pages[k];
                    article = Object.values(articles).filter(article => article.url.replace('http:', 'https:') == pdata.fullurl.replace('http:', 'https:'));
                    if (article) {
                        article[0].html = pdata.extract;
                    }
                }
                for (let title in articles) {
                    let article = articles[title];
                    let article_el = $('.article:first').clone().appendTo('#sidebar-content');
                    article_el.data('title', title).attr('title', title).find('.article-title a').text(title).attr('href', article.url);
                    if (article.html)
                        article_el.find('.article-content').html(article.html);
                    if (is_ff)
                        article_el.show();
                    article.article_el = article_el;
                }
                $('#sidebar-content').on('mouseenter', '.article-title', e => {
                    $(articles[$(e.target).parents('.article').data('title')].node).css('outline', '1px solid #f00');
                }).on('mouseleave', '.article-title', e => {
                    $(articles[$(e.target).parents('.article').data('title')].node).css('outline', 'none');
                })
                MathJax.typeset();
            }
        });
    }
});

function svg_a_click(e) {
    e.preventDefault();
    e.stopPropagation();
    var a = $(e.target);
    if (a[0].tagName != 'a')
        a = a.parents('a');
    a = a[0];
    if ('title' in a.attributes && a.attributes.title.value in articles) {
        let article_el = articles[a.attributes.title.value].article_el;
        article_el.show()
        $('#sidebar').animate({scrollTop: article_el[0].offsetTop}, 400);
    }
    return false;
}

function svg_mouse_leave_event(e) {
    down = false;
}

function svg_mouse_down_event(e) {
    e.preventDefault();
    e.stopPropagation();
    down = true;
    dsx = e.clientX;
    dsy = e.clientY;
}

function svg_touch_start_event(e) {
    dsx = e.touches[0].pageX;
    dsy = e.touches[0].pageY;
}

function svg_mouse_up_event(e) {
    if (down) {
        e.preventDefault();
        e.stopPropagation();
        down = false;
    }
}

function svg_mouse_move_event(e) {
    if (!down)
        return;
    e.preventDefault();
    e.stopPropagation();
    svg_move(e.clientX, e.clientY)
}

function svg_mouse_wheel_event(e) {
    svg_zoom(e.clientX, e.clientY, Math.sign(e.deltaY));
}

function svg_touch_move_event(e) {
    if (e.touches.length == 1) {
        svg_move(e.touches[0].pageX, e.touches[0].pageY);
    } else if (e.touches.length == 2) {
        let cur_diff = Math.abs(e.touches[0].pageX - e.touches[1].pageX);
        if (cur_diff > 0) {
            let x = (e.touches[0].pageX + e.touches[1].pageX) / 2;
            let y = (e.touches[0].pageY + e.touches[1].pageY) / 2;
            if (cur_diff > touch_diff)
                svg_zoom(x, y, -1);
            if (cur_diff < touch_diff)
                svg_zoom(x, y, 1);
        }
        touch_diff = cur_diff;
    }
}

function svg_zoom(x, y, dir) {
    let [cx, cy, cw, ch] = svg.getAttribute('viewBox').split(' ');
    let nw = Math.min(cw * (1 + dir * zoom_scale), srect.width);
    let nh = Math.min(ch * (1 + dir * zoom_scale), srect.height);
    let nx = Math.max(cx - (nw - cw) * (x / svgc.clientHeight), (srect.width / 2) * -1);
    let ny = Math.max(cy - (nh - ch) * (y / svgc.clientHeight), 0);
    if (nw + nx > srect.width)
        nx = srect.width - nw;
    if (nh + ny > srect.height)
        ny = srect.height - nh;
    svg.setAttribute('viewBox', `${nx} ${ny} ${nw} ${nh}`);
    if (!is_ff)
        show_visible_equations();
}

function svg_move(x, y) {
    let [cx, cy, cw, ch] = svg.getAttribute('viewBox').split(' ').map(val => parseFloat(val));
    let nx = Math.max(cx + (dsx - x) * cw / svgc.clientHeight, (srect.width / 2) * -1);
    let ny = Math.max(cy + (dsy - y) * ch / svgc.clientHeight, 0);
    if (isNaN(nx))
        return;
    if (isNaN(ny))
        return;
    dsx = x;
    dsy = y;
    if (cw + nx > srect.width)
        nx = srect.width - cw;
    if (ch + ny > srect.height)
        ny = srect.height - ch;
    svg.setAttribute('viewBox', `${nx} ${ny} ${cw} ${ch}`);
    if (!is_ff)
        show_visible_equations();
}

function scan_title_attr(node) {
    if (!('title' in node.attributes) && (node.parentElement && node.parentElement.tagName !== 'svg'))
        return scan_title_attr(node.parentElement);
    if (node.attributes.title)
        return node;
    return null;
}

function show_visible_equations() {
    let vrect = svg.getBoundingClientRect();
    var cx = vrect.width / 2;
    var cy = vrect.height / 2;
    let nodes = [... new Set([... svg.getEnclosureList(srect, svg)].map(
        node => scan_title_attr(node)).filter(
        title => !!title))].sort((node1, node2) => {
            let r1 = node1.getBoundingClientRect();
            let r2 = node2.getBoundingClientRect();
            return Math.hypot(cx - (r1.x + r1.width / 2), cy - (r1.y + r1.height / 2)) - Math.hypot(cx - (r2.x + r2.width / 2), cy - (r2.y + r2.height / 2));
    });
    if (nodes.length >= 30) {
        $('#sidebar-welcome').show();
        $('#sidebar-content').hide();
    } else {
        $('#sidebar-welcome').hide();
        $('#sidebar-content').show();
        let titles = nodes.map(node => node.attributes.title.value);
        $('.article').each((i, article) => {
            article = $(article);
            let idx = titles.indexOf(article.data('title'));
            article.toggle(idx >= 0);
            if (idx >= 0)
                article.css('order', idx);
        });
    }
}
