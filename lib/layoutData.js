// Independent layout settings must start together: on a cold render one slow database read
// should not be added to the latency of every other read. The assistant still respects the
// site-status switch and is never read while the site is down or in saver mode.
export async function loadLayoutData(loaders) {
  const statusPromise = loaders.getSiteStatus();
  const assistantPromise = statusPromise.then((status) => (
    status.mode === 'down' || status.mode === 'saver' || status.features.assistant === false
      ? { enabled: false, name: 'Noor', voiceMode: 'browser', greeting: '' }
      : loaders.getPublicAssistant()
  ));
  const [themeMode, status, categories, music, quran, inject, assistant] = await Promise.all([
    loaders.getThemeMode(), statusPromise, loaders.getCategories(), loaders.getAppMusic(),
    loaders.getQuranConfig(), loaders.getInject(), assistantPromise,
  ]);
  return { themeMode, status, categories, music, quran, inject, assistant };
}
