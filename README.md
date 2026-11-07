# UjianKita Test APK

This is the student-side Android test client. It reads the existing public token sheet, validates an entered token, and opens the matching Google Form inside the app.

## Test behavior

- Reads the columns `MAPEL`, `KELAS`, `SESI`, `TOKEN`, `DURASI`, `HARI`, and `LINK SOAL` from the supplied spreadsheet.
- Ignores empty token rows.
- Starts with **Mode uji jadwal** enabled so test tokens work outside their scheduled day.
- Reads name/class values entered on the first Google Form page when the field label contains `nama` or `kelas`.
- Blocks Android screenshots and screen recordings using `FLAG_SECURE`.
- Counts app background events and locks the local test session after three events.

## Build without Android Studio

1. Create a repository from this folder and connect it to Codemagic.
2. Select the `android-test-apk` workflow in `codemagic.yaml`.
3. Download the debug APK from the completed build artifacts.

Codemagic recreates the normal Android platform folder during its build, so this project does not need Android Studio or a local Android SDK.

## Production boundary

The public Google Sheet is only used for this test. It exposes its token values to anyone with the link, so production must validate tokens through a server and store activity records in a protected database.
