# Replay Theater terms of use

Effective date: **11 October 2026**

Publisher and maintainer: **Feida Wang**. These terms cover **Replay Theater — Skills-only edition** distributed through [FeidaWang/Reply-Theatre](https://github.com/FeidaWang/Reply-Theatre), including the bundled skill, Python scripts, local viewer and related documentation.

## Licence and price

This edition is free to download and use. The publisher charges no subscription or usage fee for it and offers no paid support plan. Your assistant platform, hosting, internet connection or other third-party services may have their own charges and terms.

The software is licensed under the [MIT licence](LICENSE). That licence governs permission to use, copy, modify and redistribute the software. These terms do not reduce the rights it grants. Preserve the required copyright and licence notices when redistributing it, and observe the notices for bundled third-party material in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The MIT licence takes precedence if these terms conflict with its software permissions.

## Intended use and requirements

Replay Theater helps you inspect recorded local file edits or a supplied saved JSON record and export an HTML replay. It requires Python 3.9 or later. Native history collection additionally requires a compatible local Codex app-server, permission to access the selected chat and its verified identifier. Installing this skill does not grant filesystem access, a Codex engine or account permissions to a cloud environment.

This edition has no MCP connection, automatic file-capture hooks or publisher-operated replay server. It does not change your project files as part of replay, but it writes replay snapshots, viewer state and requested exports. An export can overwrite the destination you select. Use an appropriate output path and retain any backups you need.

Follow the permissions and trust rules of your host, organisation and operating system. Use existing compatible software; do not modify installed browser or application bundles, bypass review gates or weaken access controls to make the viewer run.

## Your content and sharing choices

You retain your existing rights in your source code, saved records and other content. Merely running this local edition does not transfer ownership of your content to Feida Wang or grant the publisher access to it.

Only process chats and files you are authorised to access. Check whether you are permitted to disclose any code, paths or personal information before uploading a record to an assistant, copying a diff into a message, posting a GitHub issue or sharing exported HTML. Respect other people's rights and applicable laws. Do not use the software for unauthorised access or to collect other people's confidential information.

The [privacy policy](PRIVACY.md) explains local storage, retention and the distinction between this edition and third-party platform processing. Keep sensitive information out of the public support tracker and use a synthetic example when reporting a problem.

## Interpretation and limitations

A replay is a view of saved evidence, not a guarantee of a complete or accurate reconstruction of every filesystem change. Shell, formatter, MCP and subagent edits can be absent. Native failed, declined or incomplete diffs can be proposals rather than applied changes. Supplied v2 records may contain observed changes with uncertain attribution or order. Missing earlier file content cannot be recovered from a partial diff alone.

Review the displayed source, status and uncertainty labels before relying on a result. The software is not a backup service, authoritative audit log or substitute for checking the files and history available to you. Its current interface uses Simplified Chinese labels. Host capabilities and supported history interfaces can change.

## Warranty, liability and statutory rights

The software is provided on the warranty and liability terms in the MIT licence, to the extent permitted by applicable law. There is no promise of uninterrupted availability, complete capture, compatibility with every host or a particular outcome. Nothing in these terms or the software's disclaimers excludes, restricts or modifies a right, guarantee or remedy that applicable law does not permit to be excluded, including applicable Australian Consumer Law protections.

## Third-party services and affiliation

GitHub, OpenAI, Codex and other assistant or browser services are governed by their own terms and privacy policies. This project does not act for those providers and is not an official OpenAI product. Publishing the source or ZIP on GitHub does not mean OpenAI has approved it or listed it in its directory. Modified editions and remote MCP services operated by others are outside these terms' scope.

## Support, ending use and updates

For support or questions about these terms, use [SUPPORT.md](SUPPORT.md). The public issue channel has no guaranteed response time. Avoid posting sensitive information.

You can stop using the software at any time, stop its local viewer and uninstall the skill. Saved records and exports remain until you delete them; follow the privacy policy for local data removal. Stopping use does not cancel the MIT permissions already granted for software you received.

Changes to these terms will be published here with a revised effective date and visible Git history. The applicable MIT licence for a distributed copy continues to govern that copy. Check the terms and policy accompanying the version you choose to use.
