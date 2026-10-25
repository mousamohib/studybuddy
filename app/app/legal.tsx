// DRAFT legal text. Have it reviewed (Quebec Law 25, PIPEDA, UK GDPR) before charging money or launching publicly.
import { Stack, useLocalSearchParams } from 'expo-router';
import { Rich } from '@/components/Rich';
import { Card, Screen, T } from '@/components/ui';

const PRIVACY = `## Privacy Policy (draft)
*Last updated: October 2026. Contact: the Scrawlie team (add an email address before launch).*

**What we collect:** your account details (name, email, country, school), the course files you upload, your deadlines, study plans, chats, sheets and papers, and usage counts for billing.

**Why:** only to run Scrawlie for you: reading your files, planning your study and answering your questions.

**AI processing:** your questions and the relevant parts of your files are sent to our AI provider (Anthropic) to generate answers. Under its commercial terms, this data is not used to train its models.

**Where it's stored:** on Supabase servers in Canada. The UK recognises Canada as providing adequate protection for personal data.

**Who can see it:** only you. Course files are never shared. If you share a sheet or paper by link, anyone with that link can read that one document until you turn the link off.

**Your rights:** you can export or delete all your data at any time in Profile. Deleting your account removes your files and everything else permanently. Under Quebec's Law 25, PIPEDA and UK GDPR you can also ask us what we hold about you and have it corrected.

**Age:** Scrawlie is for people aged 17 and over.

**Person responsible for personal information:** Mousa Mohiburrahman (add contact details before launch).`;

const TERMS = `## Terms of Use (draft)
*Last updated: October 2026.*

1. **Who can use it:** you must be 17 or older.
2. **Your content:** you keep ownership of what you upload. Only upload course material you're allowed to use for your own study. Don't share course files publicly.
3. **AI answers can be wrong.** Check important facts against your course material. Scrawlie is a study aid, not a replacement for your classes.
4. **Academic integrity:** follow your school's rules on AI. Integrity mode helps you avoid generating work you would submit, but you are responsible for what you hand in.
5. **Plans and payments:** the free plan has monthly limits. Pro is a monthly or yearly subscription you can cancel at any time through your app store.
6. **Fair use:** don't misuse the service or try to get around limits.
7. **Changes:** we may update these terms and will tell you in the app when we do.`;

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  return (
    <Screen>
      <Stack.Screen options={{ title: doc === 'terms' ? 'Terms of Use' : 'Privacy Policy' }} />
      <Card><T variant="small" muted>Draft text, to be reviewed before Scrawlie launches publicly.</T></Card>
      <Rich text={doc === 'terms' ? TERMS : PRIVACY} />
    </Screen>
  );
}
