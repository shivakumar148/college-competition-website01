# College Competition Registration Website

A local student registration website for KALPATARU INSTITUTE OF TECHNOLOGY college competitions.

## Run

```powershell
node server.js
```

Open:

```text
http://localhost:3000
```

## Admin Login

```text
Email: admin@collegefest.local
Password: admin123
```

## Included

- Student login and registration
- KALPATARU INSTITUTE OF TECHNOLOGY branding
- Student personal, academic, and college details
- Competition selection with fixed Rs. 1000 fee
- Team registration for 2 to 4 members
- UPI QR payment screen
- Required UPI transaction/reference ID before registration is submitted
- Student registration progress tracker
- Digital entry pass with QR code
- Competition guide cards
- Team members list
- Admin dashboard for paid and unpaid registrations
- Admin search, filters, CSV export, refresh, verification status, and event summary
- Local JSON data storage in `data/db.json`

## UPI Payment Setup

Open `data/settings.json` and replace the placeholder UPI ID with your own:

```json
{
  "upiId": "your-upi-id@bank",
  "upiName": "College Competition Fees"
}
```

After that, restart the website. Students will see a UPI QR code for Rs. 1000 and can open their UPI app from the payment screen.

## Registration Flow

Student details are saved first with `Awaiting Payment` status. The registration becomes `Submitted` only after the student pays through UPI and enters the UPI transaction/reference ID. Admin can verify or reject only paid registrations.

## Put It Online For All Mobiles

To use this from any phone anywhere, host it on a Node.js web hosting service such as Render or Railway.

### Recommended Simple Setup: Railway

1. Create a GitHub account.
2. Create a new GitHub repository and upload this project folder.
3. Go to Railway and create a new project from the GitHub repository.
4. Railway should detect Node.js automatically.
5. Set the start command:

```text
npm start
```

6. Add these environment variables in Railway:

```text
ADMIN_EMAIL=admin@collegefest.local
ADMIN_PASSWORD=change-this-password
UPI_ID=shivu200500@ibl
UPI_NAME=Shiv
```

7. Add a Railway Volume for saved student data.
8. Mount the volume to:

```text
/app/data
```

9. Deploy the project.
10. Open the public Railway URL on any mobile phone.

### Render Setup

1. Upload the project to GitHub.
2. In Render, create a new Web Service from the GitHub repository.
3. Use:

```text
Build Command: npm install
Start Command: npm start
```

4. Add environment variables:

```text
ADMIN_EMAIL=admin@collegefest.local
ADMIN_PASSWORD=change-this-password
UPI_ID=shivu200500@ibl
UPI_NAME=Shiv
```

5. For saved student data, attach a persistent disk mounted at:

```text
/opt/render/project/src/data
```

Render persistent disks are for paid web services. Without persistent storage, student registrations may be lost after restart/redeploy.

### Important Before Sharing

- Change `ADMIN_PASSWORD`.
- Keep the admin link/password private.
- Test with one student registration before sharing with everyone.
