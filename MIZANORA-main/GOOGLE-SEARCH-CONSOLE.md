# Google Search Console: quick boost checklist for mizanora.vercel.app

1. Add property: Search Console > Add property > URL prefix > https://mizanora.vercel.app
2. Verify: choose "HTML tag", copy only the content="..." value into Vercel env `NEXT_PUBLIC_GSC_VERIFICATION`, redeploy, click Verify.
3. Sitemap: Sitemaps > add `sitemap.xml` (the site already generates it, now including /workers and all blogs).
4. URL Inspection: paste each important URL (home, /products, /workers, /blog, 5 best products, each new blog) > "Request indexing". Do about 10 a day (there is a daily limit).
5. Links: put the site link in your Facebook page, Instagram bio, TikTok bio, YouTube channel About, and WhatsApp Business profile. Real links from real profiles help Google find you.
6. Content: publish 2 blog posts a week. Each product needs a unique title, description and 2+ clear photos. Do not copy supplier text.
7. Speed: check "Core Web Vitals" and "Page indexing" reports every week. Fix "Crawled - currently not indexed" pages by improving the content and adding internal links from the blog.
8. Brand: Google Business Profile is only for places customers can visit. Skip it unless you have a shop address.
9. Be patient: a new site usually needs weeks to a few months to rank. There is no safe shortcut. Avoid paid link packages: they can get the site penalised.

---

## v19 additions

- **Blog RSS feed:** `https://mizanora.vercel.app/blog/feed.xml` (linked from every page's `<head>`). In Search Console you can submit it next to `sitemap.xml` (Sitemaps > add `blog/feed.xml`).
- **9 new shopping guides** (saving money, sale seasons, product quality, privacy, winter clothes, gifts, women fashion, market rate, worker pricing). Each one links to related guides and to product pages, which helps Google crawl the shop. Request indexing for each new URL (about 10 a day).
- **Bing Webmaster Tools:** put its verification code in Vercel env `NEXT_PUBLIC_BING_VERIFICATION` and redeploy.
- **Speed:** the background music file is no longer downloaded until it really starts playing.
