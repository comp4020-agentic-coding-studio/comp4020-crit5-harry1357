# Crit 5 — Record of Interview

## The breakthrough

It was realising that my probe had been lying to me, and that the lie was
shaped exactly like the ones I keep writing.

I was driving the built page over CDP to script a playthrough. After each
click I waited for the answer buttons to exist. They always did — the old list
is still in the DOM for the 110ms it spends fading out. So the probe clicked a
dying button, the app's re-entry guard quietly swallowed it, and the whole run
sat one step behind while every number it printed looked reasonable. What it
finally reported was "the long line never appeared", which is indistinguishable
from a broken typewriter.

That's the same failure as the crit-4 note in my `CLAUDE.md` about screenshots
of a viewport that was never tested, and the same as axe's disabled contrast
rule: three different tools, all reporting success because none of them were
actually looking. Once I saw them as one shape I stopped debugging the page and
started auditing my sensors — which is how I found that `--ink-faint` had
shipped at 3.01:1 and that my "always visible" indicator scrolled off screen.

## What it changed

I used to treat a green check as the end of a question. I now think the more
useful question is *what would this check look like if it had stopped working*
— and if the answer is "exactly like passing", it isn't a check yet. That's why
I made myself watch `spec/contrast.test.ts` fail on the real bad value before I
trusted it, and why the contrast sensor reads the built CSS rather than the
source.

The developer I want to be is one who is suspicious of good news.
