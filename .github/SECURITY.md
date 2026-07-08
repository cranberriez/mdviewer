# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately rather than opening a public
issue. Use GitHub's **Report a vulnerability** button under the repository's
**Security** tab, or contact the maintainer directly.

Please include, where possible: affected version, a description of the issue,
and steps to reproduce. You can expect an initial response within a few days.

## How MDViewer releases are secured

Every release is built by GitHub Actions from a tagged commit — never from a
maintainer's local machine — so the published installer provably corresponds to
the source in this repository. Each release includes:

- **SHA-256 checksums** (`checksums.txt`) for every installer.
- **Build provenance attestations** linking each installer to the exact commit
  and workflow run that produced it.
- **A CycloneDX SBOM** (`*-sbom.cdx.json`) listing the full dependency tree.

### Verifying a download

Verify the checksum (PowerShell):

```powershell
Get-FileHash .\MDViewer-<version>-x64-setup.exe -Algorithm SHA256
# compare the output against the matching line in checksums.txt
```

Verify the build provenance with the GitHub CLI:

```bash
gh attestation verify MDViewer-<version>-x64-setup.exe --repo cranberriez/mdviewer
```

A successful verification confirms the installer was built by this repository's
release workflow from the corresponding tagged commit.

## Windows SmartScreen

Installers are not yet signed with a code-signing certificate, so Windows
SmartScreen may warn on first run. The provenance attestation and checksums
above let you confirm the download's integrity in the meantime.

## Supported versions

Only the latest released version receives security fixes.
