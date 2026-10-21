/**
 * 主题预加载脚本（防 FOUC）
 *
 * 在 Vue 应用挂载前同步执行：读取 localStorage 中的主题选择，
 * 通过同步 XHR 加载 config/themes.json 并提前应用 CSS 变量，
 * 最后移除 data-theme-loading 属性使页面可见。
 *
 * 注意：扩展环境 CSP（script-src 'self'）禁止内联脚本，
 * 因此本脚本必须以外部文件形式放在 public/ 下，由 index.html 以 <script src> 引入。
 */
(function () {
    try {
        var selectedTheme = localStorage.getItem('selectedTheme');
        var request = new XMLHttpRequest();
        request.open('GET', 'config/themes.json', false);
        request.send(null);
        var config = JSON.parse(request.responseText || '{}');
        var themes = config.themes || [];
        var theme = themes.find(function (t) { return t.id === selectedTheme; });
        if (!theme) {
            theme = themes.find(function (t) { return t.id === config.defaultTheme; }) || themes[0];
        }
        if (theme && theme.colors) {
            var root = document.documentElement;
            root.setAttribute('data-theme', theme.id);
            if (theme.isDark) {
                root.classList.add('dark-mode');
            }
            for (var key in theme.colors) {
                if (Object.prototype.hasOwnProperty.call(theme.colors, key)) {
                    root.style.setProperty(key, theme.colors[key]);
                }
            }
            var metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (metaThemeColor && theme.colors['--md-sys-color-primary']) {
                metaThemeColor.setAttribute('content', theme.colors['--md-sys-color-primary']);
            }
        }
    } catch (e) {
        // 主题预加载失败时保持默认，避免阻塞页面渲染
    } finally {
        document.documentElement.removeAttribute('data-theme-loading');
        document.documentElement.setAttribute('data-theme-loaded', 'true');
    }
})();
