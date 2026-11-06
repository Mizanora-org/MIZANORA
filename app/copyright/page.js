import { SITE } from '@/lib/config';
import { pageMeta } from '@/lib/seo';
import { PageHead, Prose } from '@/components/Prose';

export const metadata = pageMeta({
  title: 'Copyright & takedown (DMCA)',
  description:
    'Report a movie, series, poster or other content on Mizanora that you own and want removed. Step-by-step takedown process and what to include.',
  path: '/copyright',
});

export default function CopyrightPage() {
  return (
    <>
      <PageHead
        title="Copyright &amp; takedown"
        intro="Agar aap ka content ghalat tareeqe se dikh raha hai to humein batayein — hum foran action lete hain."
        crumbs={[['/', 'Home'], [null, 'Copyright']]}
      />
      <Prose>
        <p>
          Mizanora sirf licensed, public-domain, Creative Commons ya apne content ko tarjeeh deta hai. Phir bhi
          agar koi poster, synopsis, video ya play server ghalti se aap ke rights ke khilaf mojood ho, to yeh
          page batata hai ke kaise report karein aur hum kitni jaldi jawab dete hain.
        </p>

        <h2>Report kaise karein</h2>
        <ol>
          <li>
            Email karein <a href={`mailto:${SITE.email}?subject=Copyright%20takedown%20request`}>{SITE.email}</a> par,
            subject mein <b>“Copyright takedown request”</b> likhein.
          </li>
          <li>
            Ya WhatsApp karein <a href={`https://wa.me/${SITE.whatsapp}`}>+{SITE.whatsapp}</a> par aur message ke
            shuru mein “Copyright” likhein (photos/screenshots attach kar sakte hain).
          </li>
        </ol>

        <h2>Message mein kya shamil karein</h2>
        <ul>
          <li>Woh Mizanora URL(s) jahan content dikh raha hai (jaise <code>/movies/…</code> ya <code>/live/…</code>).</li>
          <li>Aap ka poora naam, company (agar ho), email aur phone.</li>
          <li>Woh asal kaam jis ka aap haq rakhte hain — title, saal, aur us ka official link.</li>
          <li>
            Ikhtiyar ki tasdeeq: “Main tasdeeq karta/karti hoon ke yeh content meri milkiyat hai ya main uske
            maalik ki taraf se bol raha/rahi hoon, aur di gayi maloomat sach hai.”
          </li>
          <li>Agar ho to registration/copyright number ya licence agreement ka hawala.</li>
        </ul>
        <p>
          Ghalat ya jhooti report qanooni zimmedari la sakti hai — baraye meharbani sirf sach maloomat dein.
        </p>

        <h2>Hum kya karte hain</h2>
        <ul>
          <li>
            <b>24 ghante ke andar</b> har mukammal report ko acknowledge karte hain.
          </li>
          <li>
            Saaf aur seedhe case mein <b>48 ghante ke andar</b> content ya play server <b>off</b> kar diya jata hai
            (page se hata kar, ya admin panel se server disable karke). Remove karne se pehle hum asal source
            dobara check karte hain.
          </li>
          <li>
            Aap ko likhit jawab milta hai: kya hataya, kab, aur (agar maloom ho) kis source ki wajah se aaya tha.
          </li>
          <li>
            Repeat offenders ke play servers permanently band kar diye jate hain.
          </li>
        </ul>

        <h2>Counter-notice</h2>
        <p>
          Agar aap samajhte hain ke content ghalti se hata diya gaya (misal: public-domain film, ya aap ke paas
          licence hai), to usi email par licence ka saboot bhejein. Hum 7 kaam ke dinon mein jawab dete hain aur
          saboot theek ho to content wapis laga dete hain.
        </p>

        <h2>Metadata aur posters</h2>
        <p>
          Posters, cast photos aur synopsis TMDB, TVmaze, IMDb public suggestion aur Internet Archive se aate hain.
          Kabhi kabhi purani ya ghalat image aa jati hai. Aap sirf image hataane ki darkhwast bhi kar sakte hain —
          page rehne dein, tasveer remove kar dein. Hum aise case 3 kaam ke dinon mein theek karte hain.
        </p>

        <h2>Zaroori note</h2>
        <p>
          Mizanora kisi bhi movie ka file khud host ya upload nahi karta. Play servers site admin add karta hai.
          Is liye takedown request par hum sab se pehle woh server disable karte hain, phir maloom karte hain ke
          source kahan se aaya. Hum aap ko woh source bhi bata dete hain taake aap seedha wahan bhi report kar sakein.
        </p>

        <p>
          Mazeed tafseel ke liye <a href="/licence">Licence &amp; streaming rights</a>, <a href="/terms">Terms of use</a> aur{' '}
          <a href="/privacy-policy">Privacy policy</a> parhein.
        </p>
      </Prose>
    </>
  );
}
