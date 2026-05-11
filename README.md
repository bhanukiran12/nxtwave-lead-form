# NxtWave Lead Form Frontend

A multi-step React form for lead registration with OTP verification, built with Vite and deployed on Vercel/Netlify.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Form Flow](#form-flow)
- [Components](#components)
- [Hooks](#hooks)
- [Utilities](#utilities)
- [External Integrations](#external-integrations)
- [Configuration](#configuration)
- [Development Setup](#development-setup)
- [Building & Deployment](#building--deployment)
- [Analytics](#analytics)
- [Styling](#styling)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Features

- 3-step multi-page form with progress indicator
- Real-time input validation
- OTP verification via MSG91 provider
- Confetti celebration animation
- Google Sheets integration for lead storage
- Analytics tracking via dataLayer (GTM)
- Parent-iframe communication for UTM attribution
- Fully responsive design
- Mobile-friendly OTP input

## Tech Stack

| Tool | Purpose | Version |
|------|---------|---------|
| React | UI library | 18.3.1 |
| Vite | Build tool & dev server | 5.4.11 |
| @vitejs/plugin-react | React plugin for Vite | 4.3.3 |
| MSG91 | OTP verification service | - |
| Google Sheets | Lead storage | - |
| Segment | Analytics (via backend) | - |
| Express (dev only) | Local backend server | 4.18.2 |

## Project Structure

```
nxtwave-lead-form/
├── public/               # Static assets (if any)
├── src/
│   ├── components/
│   │   ├── StepOne.jsx         # Name, mobile, mode selection
│   │   ├── StepTwo.jsx         # Grad year, state, demo slot
│   │   ├── StepThree.jsx       # OTP verification
│   │   ├── SuccessStep.jsx     # Success confirmation
│   │   └── ProgressStepper.jsx # Step progress indicator
│   ├── hooks/
│   │   ├── useOtp.js           # OTP state & MSG91 integration
│   │   ├── useDataLayer.js     # GTM dataLayer & parent communication
│   │   └── useSubmissionPayload.js # Form data transformation
│   ├── constants/
│   │   └── formConstants.js    # API URLs, config values
│   ├── utils/
│   │   └── demoSlots.js        # Demo slot generation & parsing
│   ├── App.jsx                 # Main form orchestrator
│   ├── App.css                 # All component styles
│   └── main.jsx                # React entry point
├── backend/
│   ├── server.cjs              # Legacy HTTP server
│   ├── server-express.cjs      # Local Express dev server
│   ├── api/
│   │   └── post-otp-events.js  # API route index
│   ├── post-otp-events-handler.js  # Vercel serverless
│   └── utils.cjs               # Local utils copy
├── index.html                  # HTML template
├── vite.config.js              # Vite configuration
├── vercel.json                 # Vercel headers config
├── package.json                # Dependencies & scripts
└── package-lock.json           # Locked dependencies
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser (React)                      │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │  App.jsx (State: step, store, form values)             │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │  StepOne.jsx → StepTwo.jsx → StepThree.jsx → Success  │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ├── useOtp (MSG91 integration)   │
│                            ├── useDataLayer (analytics)    │
│                            └── useSubmissionPayload (data) │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ HTTP requests
                            ▼
┌───────────────────────────────────────────────────────────┐
│               Backend: nxtwave-lead-backend                │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  POST /api/post-otp-events                           │ │
│  │  1. Draft User API → UUID                            │ │
│  │  2. Segment Track → analytics                        │ │
│  │  3. CRM Track → activity log                         │ │
│  └──────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
                            │
                            ▼
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ Draft User │  │  Segment   │ │    CRM     │
    │    API     │  │ Analytics  │ │  (Flow)    │
    └────────────┘  └────────────┘  └────────────┘
```

## Form Flow

```
[Step 1: Personal Info]
  ├─ Full Name (min 3 chars, letters only)
  ├─ Mobile Number (10 digits)
  └─ Mode: Online / In Classroom
        ↓ [Validated]
        ↓
[Step 2: Additional Details]
  ├─ Demo Slot (Online only)
  ├─ Year of Graduation
  └─ Native State
        ↓ [Validated]
        ↓
[Step 3: OTP Verification]
  ├─ MSG91 sends 6-digit OTP via SMS
  ├─ User enters OTP in 6 input boxes
  └─ Verify → Success or Error
        ↓ [OTP Verified]
        ↓
[Success Page]
  ├─ Confetti animation
  ├─ Success message
  └─ Slot details (Online only)
```

## Components

### StepOne.jsx

First step: collects user's name, mobile number, and preferred study mode.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `nameValue` | string | Current name input |
| `setNameValue` | function | Setter for name |
| `mobileValue` | string | Current mobile input |
| `setMobileValue` | function | Setter for mobile |
| `mode` | 'Online' \| 'In Classroom' | Selected mode |
| `setMode` | function | Mode setter |
| `nameHasError` | boolean | Show name error |
| `mobileHasError` | boolean | Show mobile error |
| `step1Valid` | boolean | Enable continue button |
| `onContinue` | function | Next step handler |
| `sanitiseName` | function | Name sanitizer (non-alpha removal) |
| `sanitiseMobile` | function | Mobile sanitizer (digits only) |

**Validation Rules:**
- Name: 3-60 characters, letters and spaces only
- Mobile: Exactly 10 digits
- Mode: Must be selected

### StepTwo.jsx

Second step: collects graduation year, native state, and demo slot (online only).

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `store` | object | Form data store |
| `setStore` | function | Store setter |
| `yearsList` | string[] | Graduation year options |
| `isClassroom` | boolean | In Classroom mode selected |
| `step2Valid` | boolean | Enable verify button |
| `onContinue` | function | Proceed to OTP step |
| `onBack` | function | Return to Step 1 |

**State-specific behavior:**
- In Classroom: Demo slot selection hidden
- Online: Demo slot required, years 2020-2026
- Classroom: Graduation years limited to 2024-2026

### StepThree.jsx

Third step: OTP verification via MSG91.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `mobile` | string | User's mobile for OTP display |
| `otpDigits` | string[] | 6-digit OTP array |
| `otpError` | boolean | Show OTP error state |
| `otpStatus` | {message, type} | Status message object |
| `resendSeconds` | number | Countdown for resend |
| `verifyLoading` | boolean | Show verify button spinner |
| `otpProviderReady` | boolean | MSG91 loaded flag |
| `onOtpRef` | function | Ref callback for input |
| `onOtpInput` | function | Digit input handler |
| `onOtpKeyDown` | function | Backspace navigation |
| `onOtpPaste` | function | Paste handler |
| `onResend` | function | Resend OTP |
| `onVerify` | function | Verify OTP |
| `onBack` | function | Return to Step 2 |

**Features:**
- Auto-focus first input on mount
- Auto-advance to next input on digit entry
- Auto-submit when 6 digits entered
- Backspace navigates to previous input
- Paste support (full OTP)
- 20-second resend cooldown
- Captcha integration via MSG91

### SuccessStep.jsx

Final step: displays success confirmation.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `isClassroom` | boolean | Mode selection |
| `demo` | string | Selected demo slot datetime |

**Messages:**
- Classroom: "Your booking is successful!" + "representatives will be in touch"
- Online: "Your demo booking is successful!" + "link 30 minutes before"

### ProgressStepper.jsx

Visual progress indicator (3 steps).

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `step` | 1 \| 2 \| 3 | Current active step |

**States:**
- Completed: Green circle with checkmark
- Active: Purple background, current step number
- Inactive: Gray background, step number

## Hooks

### useOtp

Manages OTP state and MSG91 integration.

**Parameters:**
```js
useOtp({ mobile, onOtpAction, onVerified })
```

**Returned API:**

| Property | Type | Description |
|----------|------|-------------|
| `otpDigits` | string[] | 6-digit array |
| `otpError` | boolean | Invalid OTP flag |
| `otpStatus` | object | `{ message, type }` |
| `resendSeconds` | number | Countdown |
| `verifyLoading` | boolean | Verify in progress |
| `otpProviderReady` | boolean | MSG91 loaded |
| `setOtpRef` | function | Input ref callback |
| `handleOtpInput` | function | Digit change handler |
| `handleOtpKeyDown` | function | Key down handler |
| `handleOtpPaste` | function | Paste handler |
| `resendOtp` | function | Resend OTP |
| `verifyOtp` | function | Verify OTP |
| `initializeOtpFlow` | function | Init OTP send |
| `stopOtpTimer` | function | Clear timer |

**Flow:**
1. Component mounts → `initializeOtpFlow()` called
2. Loads MSG91 script from CDN
3. Initializes MSG91 with widget ID & token
4. Sends OTP via `window.sendOtp()`
5. User enters digits → `verifyOtp()` called
6. Success → `onVerified` callback

**MSG91 Configuration:**
- Widget ID: `3663656d6c34303137353639`
- Token Auth: `498239TypIWEjBdX69b10f5dP1`
- Script: `https://verify.msg91.com/otp-provider.js`
- Channel: SMS (`11` for resend)

### useDataLayer

Manages Google Analytics 4 dataLayer events and parent iframe communication.

**Parameters:**
```js
useDataLayer({ parentOrigins, parentPageUrls, formId })
```

**Returned API:**

| Property | Type | Description |
|----------|------|-------------|
| `sessionId` | string | Unique session identifier |
| `pushDataLayerEvent` | function | Push event to dataLayer |
| `trackStepView` | function | Track step navigation |
| `trackFieldInteraction` | function | Track field changes |
| `trackOtpAction` | function | Track OTP events |
| `trackFormSubmission` | function | Track completion |

**Events Tracked:**
- `page_load` - Initial page view (once per session)
- `step_viewed` - When step becomes active
- `field_changed` - On input change
- `otp_send`, `otp_sent_success`, `otp_send_failed`
- `otp_attempt`, `otp_verified_success`
- `form_submitted` - On OTP success

**Parent-iframe Communication:**
- `REQUEST_PARENT_URL_CONTEXT` - Request parent URL
- `REQUEST_PARENT_UTM` - Request UTM params
- `PARENT_URL_CONTEXT` - Response with parent URL
- `PARENT_UTM` / `UTM_PARAMS` - Response with UTM data
- Retries with delays: 800ms, 1800ms, 3000ms, 4500ms, 6500ms
- Fallback after 8 seconds if no response

### useSubmissionPayload

Builds submission payload for backend with UTM attribution.

**Parameters:**
```js
useSubmissionPayload({ parentOrigins, parentPageUrls })
```

**Returned API:**

| Property | Type | Description |
|----------|------|-------------|
| `buildSubmissionPayload` | function | Creates payload object |
| `extractUtmParams` | function | Extracts UTM from all sources |

**UTM Sources (priority order):**
1. Parent iframe message (`PARENT_UTM`)
2. Parent window location (via `postMessage`)
3. Document referrer
4. Current page URL search params

**Payload Structure:**
```js
{
  form_id: 'intensive-demo-form',
  form_submission_id: '<timestamp>',
  form_submission_datetime: '2024-03-15 14:30:00',
  user_id: '', // populated from DraftUser response
  form_data: {
    selected_webinar_slot_datetime: '2024-03-15 14:30:00',
    fullName: 'John Doe',
    phoneNumber: '9876543210',
    language: 'Telugu',
    preferredMode: 'Learn from Home (Online)',
    state: 'Telangana',
    graduationYear: '2023',
    selectADateToBookASlot: '2024-03-15',
    timeSlots: '2:30 PM - 3:30 PM',
    lead_category: 'intensive_lead',
    interestedCareerPath: 'Software job',
    dedicateLearningHours: 'More than 4 hours',
    frontend_url: 'https://nxtwave.ccbp.in/intensive',
    whatsappInfoStatus: true,
    acceptTAndPrivacyPolicy: true,
    // UTM params...
  }
}
```

## Utilities

### demoSlots.js

Generates available demo slot options and parses slot values.

#### `buildDemoSlotOptions(now, count)`

Generates next N available demo slots.

**Parameters:**
- `now` - Reference date (default: current)
- `count` - Max slots to generate (default: 4)

**Returns:**
```js
[
  { value: '2024-03-15 11:00:00', label: 'Today - 11AM', slotDate: '...', slotDateTime: '...', timeSlot: '11AM - 12PM' },
  { value: '2024-03-15 18:00:00', label: 'Today - 6PM', ... },
  { value: '2024-03-16 11:00:00', label: 'Tomorrow - 11AM', ... },
]
```

**Logic:** Slots are at 11:00 AM and 6:00 PM IST. Only shows slots where current time is at least 30 minutes before slot start.

#### `parseDemoSlotValue(demoValue)`

Parses stored slot value back into display components.

**Input formats:**
- ISO datetime: `"2024-03-15 14:30:00"`
- Legacy label: `"Today - 2:30 PM"`

**Returns:** `{ label, slotDate, slotDateTime, timeSlot }`

#### `getDemoSlotDetails(slotStart, now)`

Calculates slot display info from Date object.

**Returns:**
```js
{
  label: 'Today - 2:30 PM',
  slotDate: '2024-03-15',
  slotDateTime: '2024-03-15 14:30:00',
  timeSlot: '2:30 PM - 3:30 PM'
}
```

#### Date Formatting

- `formatDateYMD(date)` → `"2024-03-15"`
- `formatDateTimeYMDHMS(date)` → `"2024-03-15 14:30:00"`
- `formatPreferredDate(ymd)` → `"15th March 2024"`
- `formatPreferredTime(datetime)` → `"2:30 PM"`
- `toIsoWithIst(datetime)` → `"2024-03-15T14:30:00+05:30"`
- `formatCurrentIstDateTime()` → `"2024-03-15 14:30:00"`

## External Integrations

### MSG91 OTP Provider

| Field | Value |
|-------|-------|
| Widget ID | `3663656d6c34303137353639` |
| Auth Token | `498239TypIWEjBdX69b10f5dP1` |
| CDN URL | `https://verify.msg91.com/otp-provider.js` |
| Captcha Container | `msg91-captcha-container` |

**Methods used:**
- `window.initSendOTP(config)` - Initialize provider
- `window.sendOtp(identifier, success, error)` - Send OTP
- `window.retryOtp(channel, success, error, reqId)` - Resend
- `window.verifyOtp(otp, success, error, reqId)` - Verify

**Identifier format:** `91` + 10-digit mobile (e.g., `919876543210`)

### Google Sheets

Lead data is stored in two ways:

1. **Stage-wise storage** (development tracking)
   - URL: `https://script.google.com/macros/s/AKfycbwqOTFg0jWOWFBOU5gPc3m7mMEhKGDN8lgm6dH7vs93Ub9hfST3dAmlAdU_Lv1uVE89jw/exec`
   - Sheet: `Leads_Stage`
   - Stages: `step1`, `step2`, `final`

2. **Direct submission** (final payload)
   - Same endpoint, no stage specified
   - Stores complete submission payload

### Backend API

- **Development**: `http://localhost:3001/api/post-otp-events`
- **Production**: `https://nxtwave-lead-backend.vercel.app/api/post-otp-events`

## Configuration

All configuration is in `src/constants/formConstants.js`:

```js
export const SHEETS_URL = 'https://script.google.com/...'
export const SHEETS_STAGE_NAME = 'Leads_Stage'
export const POST_OTP_EVENTS_API_URL = 'https://nxtwave-lead-backend.vercel.app/api/post-otp-events'
export const OTP_SECONDS = 20
export const MSG91_WIDGET_ID = '3663656d6c34303137353639'
export const MSG91_TOKEN_AUTH = '498239TypIWEjBdX69b10f5dP1'
export const MSG91_SCRIPT_SRC = 'https://verify.msg91.com/otp-provider.js'
export const MSG91_CAPTCHA_RENDER_ID = 'msg91-captcha-container'
export const PARENT_WINDOW_ORIGINS = [
  'https://ccbp.in',
  'https://ccbp-website-gamma.earlywave.in',
  'https://nxtwave.ccbp.in'
]
export const PARENT_PAGE_URLS = [
  'https://ccbp.in/intensive',
  'https://ccbp-website-gamma.earlywave.in/',
  'https://nxtwave.ccbp.in/'
]
export const GRAD_YEARS_ONLINE = ['2026', '2025', '2024', '2023', '2022', '2021', '2020']
export const GRAD_YEARS_CLASSROOM = ['2026', '2025', '2024']
export const FORM_ID = 'intensive-demo-form'
export const STEP_ID = 'USER_EXTRA_INFO_DETAILS'
export const LEAD_CATEGORY = 'intensive_lead'
export const DEMO_SLOT_CUTOFF_MINUTES = 30
```

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
cd nxtwave-lead-form
npm install
```

### Running Development Server

```bash
npm start
# or
npm run dev
```

App runs at `http://localhost:5173` (Vite default).

### Proxying API Requests

Vite config proxies `/api` requests to backend on port 3001:

```js
// vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true
    }
  }
}
```

This allows calling `POST /api/post-otp-events` without CORS during development.

### Running Backend Separately

If you need to run the backend independently:

```bash
# Terminal 1: Backend
cd backend
npm install
npm run dev  # Runs on http://localhost:3001

# Terminal 2: Frontend
npm start
```

## Building & Deployment

### Build Command

```bash
npm run build
```

Creates optimized production build in `dist/` folder.

### Preview locally

```bash
npm run preview
```

Serves the built app on `http://localhost:4173`.

### Deployment Options

#### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
4. Environment variables (optional):
   - `VITE_POST_OTP_EVENTS_API_URL` - Override backend URL
   - Any other constants

**Note:** `vercel.json` includes CORS headers for `/api/*` routes.

#### Netlify

1. Connect Git repository
2. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add redirect rule for SPA:
   ```json
   {
     "route": "/*",
     "status": 200,
     "rewrite": "/index.html"
   }
   ```

#### Manual Hosting

Upload `dist/` contents to any static hosting (S3, CloudFront, Firebase Hosting).

## Analytics

### dataLayer Events

All events pushed to `window.dataLayer`:

```js
// Page view
{ event: 'page_load', pageTitle, pageUrl, referrer, timestamp, sessionId, ... }

// Step navigation
{ event: 'step_viewed', step: 2, previousSteps: 1, ... }

// Field interaction
{ event: 'field_changed', fieldName: 'mobile', totalInteractions: 5, ... }

// OTP actions
{ event: 'otp_send', attemptNumber: 1, ... }
{ event: 'otp_sent_success', ... }
{ event: 'otp_send_failed', error: '...', ... }
{ event: 'otp_attempt', attemptNumber: 1, success: false, ... }
{ event: 'otp_verified_success', ... }

// Form submission
{ event: 'form_submitted', status: 'completed', totalTimeSeconds, fieldInteractions, ... }
```

### Parent Bridge

When embedded in iframe, events are forwarded to parent window:

```js
window.parent.postMessage(
  { type: 'DATALAYER_UPDATE', payload: { event: '...', ... } },
  targetOrigin
)
```

Session data persisted to localStorage under key `nxtwave_form_data_<sessionId>`.

## Styling

All styles are in `src/App.css`.

### Design System

| Token | Value |
|-------|-------|
| Primary color | `#4F46E5` (Indigo 600) |
| Success color | `#16A34A` (Green 600) |
| Error color | `#DC2626` (Red 600) |
| Font family | Inter (Google Fonts) |
| Border radius | 10px inputs, 20px card, 999px buttons |
| Control height | 46px |
| Card shadow | `0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 40px -10px rgba(79,70,229,0.12)` |

### Component Classes

| Class | Element |
|-------|---------|
| `.form-card` | Main card container |
| `.step` | Step container |
| `.step.active` | Visible step |
| `.step-content` | Scrollable content area |
| `.fields-group` | Form field vertical stack |
| `.field` | Label + input wrapper |
| `.btn-primary` | CTA button |
| `.btn-back` | Navigation back |
| `.progress-bar` | Stepper container |
| `.progress-step` | Step circle |
| `.progress-line` | Connector line |
| `.otp-grid` | OTP inputs row |
| `.otp-box` | Single OTP input |
| `.success-inner` | Success message container |

### Responsive Breakpoints

Mobile styles applied at `max-width: 480px`:
- Reduced padding (12px body, 20px card)
- Full-width card layout
- Smaller font sizes for OTP

## Testing

### Manual Test Cases

| Test | Steps | Expected |
|------|-------|----------|
| Name validation | Enter "Ab" | Error shown |
| Mobile validation | Enter "123" | Error shown |
| Mode required | No mode selected | Continue disabled |
| Step 2 validation | No grad year/state | Error on selection |
| OTP timer | Wait 20s | Resend button enabled |
| OTP auto-submit | Enter 6 digits | Auto verify |
| Back navigation | Click Back | Returns to previous step |
| Confetti | Proceed to success | Confetti animation plays |

### API Mocking

For frontend-only testing, you can mock fetch:

```js
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ ok: true, uuid: 'test-uuid' })
  })
)
```

## Troubleshooting

### OTP Not Sending
- Check MSG91 credentials in constants
- Verify MSG91 widget is active in dashboard
- Check browser console for script load errors
- Ensure mobile number is 10 digits

### CORS Errors in Dev
- Ensure backend is running on port 3001
- Check `vite.config.js` proxy is configured
- Verify `POST_OTP_EVENTS_API_URL` matches dev URL

### Data Not Appearing in Sheets
- Check Google Apps Script deployment is "Anyone with link"
- Verify `SHEETS_URL` is correct
- Check network tab for failed requests
- Review Google Cloud Console quotas

### Analytics Not Firing
- Confirm `window.dataLayer` exists
- Check parent iframe is sending URL context
- Verify `parentOrigins` match actual parent origin
- Use browser devtools → Application → localStorage to inspect `nxtwave_session_id`

## Environment-Specific Notes

### Localhost (Development)
- Backend: `http://localhost:3001`
- API proxy: `/api/*` → `http://localhost:3001`
- CORS: `http://localhost:3000` and `http://localhost:3001`
- MSG91: Production (same credentials)

### Netlify Preview Deploys
- Backend: Production Vercel URL
- API: Direct `https://nxtwave-lead-backend.vercel.app/api/...`
- CORS: Netlify domain added manually if needed

### Production (nxtwave-lead.netlify.app)
- Backend: Vercel production
- API: `https://nxtwave-lead-backend.vercel.app/api/post-otp-events`
- Origin: `https://nxtwave-lead.netlify.app` allowed in backend CORS

## Known Limitations

1. **Phone validation**: Only format validation (10 digits), no carrier check
2. **Resend limit**: Unlimited resends allowed (MSG91 rate limits apply)
3. **Session**: Session ID stored in `sessionStorage` (cleared on tab close)
4. **Sheets no-cors**: Uses `mode: 'no-cors'` → opaque responses (cannot detect failures)
5. **CRM skip**: Only intensive-demo-form triggers CRM

## Future Improvements

- [ ] Add proper form validation library (Zod/Yup)
- [ ] Implement proper error boundary
- [ ] Add loading skeletons
- [ ] Support multiple languages beyond Telugu
- [ ] Add reCAPTCHA v3 for bot prevention
- [ ] Store OTP state in URL for recovery
- [ ] Add step exit/intent tracking
- [ ] Progressive Web App (PWA) support
- [ ] A/B testing framework integration

## License

MIT
