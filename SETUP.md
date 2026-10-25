# StudyBuddy: test it step by step

Start with the website version: it's the quickest way to check everything works.

## Part A: Install what you need (one time)

1. **Node.js:** download the LTS version from https://nodejs.org/en/download and install it. To check, open a terminal (Mac: Cmd+Space → Terminal; Windows: Start → PowerShell), run `node -v` and look for `v22.x.x` or similar.
2. **VS Code** (optional, makes editing easy): https://code.visualstudio.com/download
3. **Unzip** `studybuddy.zip` onto your Desktop. You should get a `studybuddy` folder with `app`, `supabase`, `README.md` and this file.

## Part B: Set up Supabase

4. **Database tables:** open https://supabase.com/dashboard/project/uueawkqexfisdfsgibwf/sql/new and paste all of `supabase/migrations/0001_init.sql` → **Run** (if it warns about destructive operations, click **Run this query**). Then **+ New query**, paste `0002_tutor_and_sharing.sql` → **Run**. Both should say **Success**.
5. **Email confirmation off (testing only):** https://supabase.com/dashboard/project/uueawkqexfisdfsgibwf/auth/providers → **Email** → switch off **Confirm email** → **Save**.
6. **App key:** https://supabase.com/dashboard/project/uueawkqexfisdfsgibwf/settings/api-keys (or `/settings/api`). Copy the **anon public** / **publishable** key. Never the service_role / secret key, and never paste keys in chat.
7. **Settings file:** in VS Code, **File → Open Folder → studybuddy/app**, create a file named exactly `.env` containing:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://uueawkqexfisdfsgibwf.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=paste-your-key-here
   ```
   Save it.

## Part C: Put the server functions online

8. **Terminal in the studybuddy folder:** Mac: type `cd `, drag the folder into Terminal, press Enter. Windows: open the folder in File Explorer, type `powershell` in the address bar, press Enter.
9. **Log in and link:**
   ```bash
   npx supabase login
   npx supabase link --project-ref uueawkqexfisdfsgibwf
   ```
   Forgot the database password? Reset it at https://supabase.com/dashboard/project/uueawkqexfisdfsgibwf/settings/database
10. **Deploy** (one line at a time; if `--use-api` is unknown, drop it):
   ```bash
   npx supabase functions deploy ai --use-api
   npx supabase functions deploy process-file --use-api
   npx supabase functions deploy jobs --use-api
   npx supabase functions deploy delete-account --use-api
   ```
   Check https://supabase.com/dashboard/project/uueawkqexfisdfsgibwf/functions lists all four.

## Part D: Run it in your browser

11. ```bash
    cd app
    npm install
    npx expo start
    ```
    When the QR code shows, press **w** → http://localhost:8081. Ctrl+C stops it; next time just run `npx expo start` inside `app`.
12. **Try:** create an account (17+ box) → welcome steps → add a course with a real syllabus PDF → upload a lecture → Today/Calendar, type "I'm busy Friday" in *Tell the planner* → tutor, sheets, papers (sample text in demo mode) → Profile meters.

## Part E (later): On your phone

1. Expo Go: iPhone https://apps.apple.com/app/expo-go/id982107779 · Android https://play.google.com/store/apps/details?id=host.exp.exponent
2. Same Wi-Fi as the laptop, run `npx expo start` in `app`, scan the QR code (iPhone: Camera app; Android: inside Expo Go).
3. Won't connect (common on university Wi-Fi)? Use `npx expo start --tunnel`.
