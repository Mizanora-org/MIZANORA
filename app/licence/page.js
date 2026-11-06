import { SITE } from '@/lib/config';
import { pageMeta } from '@/lib/seo';
import { PageHead, Prose } from '@/components/Prose';

export const metadata = pageMeta({
  title: 'Licence & streaming rights',
  description:
    'How Mizanora licenses the movies, series, metadata, images and open-source software it uses — and the rules every play server must follow.',
  path: '/licence',
});

export default function LicencePage() {
  return (
    <>
      <PageHead
        title="Licence & streaming rights"
        intro="Kaun sa content kis ijazat se dikh raha hai — saaf likha hua."
        crumbs={[['/', 'Home'], [null, 'Licence']]}
      />
      <Prose>
        <p>
          Mizanora ek Pakistani online store hai jo movies, series, dramas aur live TV ka ek discovery hub bhi
          chalata hai. Hum sirf woh content chalate hain jiske liye hamare paas ijazat hai — apna, licensed,
          Creative Commons, ya public domain. Yeh page batata hai ke kaun si cheez kis licence ke tehat hai.
        </p>

        <h2>1. Player &amp; play servers</h2>
        <p>
          Cinema Player sirf un sources se chalta hai jo <b>Admin &gt; Movies &gt; Play Servers</b> mein add kiye
          gaye hain. Har server add karte waqt admin tasdeeq karta hai ke:
        </p>
        <ul>
          <li>server us ka apna hai, ya</li>
          <li>us ke paas us se stream karne ka licence / ijazat hai, ya</li>
          <li>content public domain ya Creative Commons hai.</li>
        </ul>
        <p>
          Mizanora kisi bhi server ko khud host, re-upload ya mirror nahi karta. Server hataane ka hukm milne par
          hum usay admin panel se foran off kar dete hain — tareeqa <a href="/copyright">Copyright &amp; takedown</a> page par hai.
        </p>

        <h2>2. Free legal full films</h2>
        <p>
          “Free Legal Film” badge sirf un titles par lagta hai jinke sath public-domain, Creative Commons, ya
          Mizanora-owned licence record mojood ho. Har aisa stream teen cheezon se guzarta hai: https-only,
          seedha media file (.mp4 / .webm / .m3u8), aur likha hua licence. Yeh record movie page par dikhta hai.
        </p>

        <h2>3. Trailers</h2>
        <p>
          Official trailers YouTube ke official embed (youtube-nocookie) se chalte hain. Trailer ke rights uske
          studio / distributor ke paas hain; Mizanora sirf official embed dikhata hai.
        </p>

        <h2>4. Metadata &amp; images</h2>
        <ul>
          <li>
            <b>TMDB</b> — jab admin apni TMDB API key save karta hai, posters, backdrops, cast photos aur story
            TMDB se aate hain. Yeh product TMDB API istemal karta hai magar TMDB se endorsed ya certified nahi hai.
          </li>
          <li>
            <b>TVmaze</b> — series ki official air dates, episodes aur posters TVmaze public API se.
          </li>
          <li>
            <b>IMDb public suggestion JSON</b> — sirf public title/person info (ID, naam, saal, poster URL).
          </li>
          <li>
            <b>Internet Archive</b> — public-domain feature films ki direct files.
          </li>
        </ul>
        <p>
          Har title page par uska IMDb ID aur “Where to Watch” official link hota hai, taake asal source tak
          pohnchna asaan rahe. Poster/metadata ke maalik ko koi aitraz ho to <a href="/copyright">takedown</a> se
          report karein — hum record correct ya remove kar dete hain.
        </p>

        <h2>5. Open-source software</h2>
        <p>Mizanora in open-source libraries par bana hai. Unki licences ka ehtram kiya jata hai:</p>
        <ul>
          <li><b>Next.js</b> — MIT</li>
          <li><b>React</b> — MIT</li>
          <li><b>hls.js</b> — Apache License 2.0</li>
          <li><b>dash.js</b> — BSD 3-Clause</li>
          <li><b>Tailwind CSS</b> — MIT</li>
          <li><b>lucide-react</b> — ISC</li>
          <li><b>Firebase SDK</b> — Apache License 2.0</li>
          <li><b>@fontsource</b> fonts — SIL Open Font License 1.1</li>
        </ul>
        <p>
          Poora source code MIT-style terms ke tehat GitHub par mojood hai. Kisi library ke author ko credit ya
          notice chahiye ho to bata dein, hum shamil kar dete hain.
        </p>

        <h2>6. Mizanora ka apna content</h2>
        <p>
          Mizanora ka naam, logo, design, product photos, product descriptions, guides aur blog posts Mizanora ki
          milkiyat hain. Bina ijazat commercial copy na karein. Aap apne orders, reviews aur messages ka data
          istemal kar sakte hain jitna aap ne khud humein bheja ho.
        </p>

        <h2>7. Ads</h2>
        <p>
          Movie pages par chalne wala pre-roll ad <b>Mizanora ka apna house ad</b> hai — koi third-party ad network
          ya tracker us overlay mein load nahi hota. Ads ke liye chune gaye products wohi hain jo shop par
          mojood hain.
        </p>

        <h2>8. Koi sawal?</h2>
        <p>
          Licence, attribution ya rights ke bare mein likhein: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
          Takedown ke liye <a href="/copyright">Copyright &amp; takedown</a> page ka form istemal karein.
        </p>
      </Prose>
    </>
  );
}
