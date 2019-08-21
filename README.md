# Launchpad toys
Some toys and demos for the Launchpad Pro.

[See it live!](https://ishanpm.github.io/launchpad-toys/)

This is an unpolished collection of random stuff. It uses the WebMidi interface to connect to the Launchpad. If you don't have a Launchpad Pro, the on-screen display will show what it's supposed to look like.

This was designed for the Launchpad Pro; other controllers may work with varying levels of success. Make sure to put the Launchpad in Programmer mode: Hold the settings button and press the orange pad in the top left.

## The modes

*paint*: Click the control buttons on the right to select a color, and click the pads to draw with that color. Click the circle button on the lower left to fill the entire area with the selected color. Hold one of the pallete buttons to change that button's color. The third and fourth control buttons on the top can go back and forth through a list of images, like a flipbook.

*pulse*: The pads will light up when you press them, then fade away.

*pressure*: The pads display the after-touch value for the entire board.

*chase*: Press the green pad! The bright white pad will become green next.

*conway*: Click pads to toggle whether they are alive or dead. The lowest control button on the right goes forward by one generation, the rest start time with various speeds.

*colortest*: All 128 colors the Launchpad can display (without SysEx messages). Press any pad to switch between the first and second set of 64.

*lightsout*: Press any pad to toggle it and the 4 adjacent pads. Try to turn every pad off. The blue control button starts a new game.

*chomp*: The game of Chomp. Take turns with an opponent. Press a pad to eat that square and all squares above and to the right. Whoever eats the pink square loses. This is rather boring on a square grid, so I suggest blocking off the first row or column before you start.

*webcam*: Displays your webcam! This is the only mode that requires SysEx messages to work, since it sets RGB values directly.