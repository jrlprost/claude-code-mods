# jr-post

At the end of a session, `/jr-post` drafts a short "what I built today" post from what actually happened in it, shows it in a pane and copies it to your clipboard.

```
jr post   LinkedIn · English · 74 words · copied

Today I shipped a billable-time tracker for my coding sessions. Every minute
is sorted into what I was doing: prompting, watching the agent work, reading,
away. The tricky part was making sure no minute is ever counted twice when
prompts overlap.

#buildinpublic

[ Copy (c) ]  [ Write another (r) ]
```

- Written from the session's own conversation: concrete, first person, 60 to 140 words.
- Plain style by design: no hype words, no em dashes, at most two hashtags, AI is not mentioned unless the work was about it.
- `/jr-post French` writes it in French this once; set your default language and platform in `/config`.
- Nothing is published: you paste it where you want.

## Commands

| Command | |
| --- | --- |
| `/jr-post` | Draft a post in your default language |
| `/jr-post <language>` | Draft it in another language |

In the pane: `c` copies again, `r` writes another version.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Language | English | Default language of the post |
| Platform | LinkedIn | LinkedIn, X, Bluesky or Mastodon: sets tone and length |

## Cost

One model call per post, on the session's own model, over the conversation as it stands (mostly served from the prompt cache).

## Install

```
/plugin install jr-post --marketplace jrlprost/claude-code-mods
```

## Access

Asks the model one question over the session's own conversation (no tools) and puts the post on your clipboard. Reads no files, runs nothing, publishes nothing.
