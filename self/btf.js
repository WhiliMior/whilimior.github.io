(() => {
  // 判断是否为英文
  const isIncludeEN = item => {
    const key = '/en/'
    return item.includes(key)
  }

  // 建立 重新导向到不同语言的 url 
  window.loadFullPage = (url) => {
    window.location.href = url
  }

  // 重新导向
  const eventFn = (elements, includeEN) => {
    elements.forEach(item => {
      if (!includeEN || !isIncludeEN(item.href)) {
        item.href = `javascript:loadFullPage('${item.href}');`
      }
    })
  }

  // 判断目前是否为英文
  const nowIncludeEN = isIncludeEN(window.location.href)

  // 修改你的 url
  const selector = nowIncludeEN
    ? document.querySelectorAll('a[href^="https://whilimior.github.io/"]') // 只需要修改这一行就好了，将https://<your-url>替换为你的blog网址。
    : document.querySelectorAll('a[href^="/en/"]')

  eventFn(selector, nowIncludeEN)
})()