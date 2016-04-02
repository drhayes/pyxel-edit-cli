# pyxel-edit-cli

A barebones PyxelEdit exporter.

## Usage

Meant to be run from the command line.

    -i The name of the .pyxel file you wish to export.
    -o The directory you want to dump all the composited tile images.

That's pretty much it! Give both as relative paths to wherever you're running this thing. Make sure the output directory already exists because this tool doesn't attempt to do that for you.

## Bugs and Missing Stuff

Because the world is a terrible place:

* Does not handle flipped tiles.
* Does not handle rotated tiles.

I just don't do this so didn't try and handle it.

## Thanks!

To Danik for making [PyxelEdit][] in the first place. Go buy it! Give Danik money!

And thanks to swistakm and Danik for laying out the file format in [this forum thread][forumthread].


  [PyxelEdit]: https://pyxeledit.com
  [forumthread]: https://pyxeledit.com/forum/discussion/154/pyxel-format-documentation
