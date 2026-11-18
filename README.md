# sheaf

Sheaf is a standalone CLI for finding GitHub pull requests by ticket key. Run one executable to print the links or open an offline HTML review checklist. No Node, npm, repository clone or server is needed to use the executable.

## Download with curl

Download the latest `main` build from GitHub Actions via nightly.link. For **macOS on Apple silicon**:

```sh
curl -fL -o sheaf.zip https://nightly.link/preacherxp/sheaf/workflows/build-cli.yml/main/sheaf-macos-arm64.zip &&
  unzip sheaf.zip && chmod +x sheaf && ./sheaf --help
```

For Intel Macs or Linux, replace `macos-arm64` in the URL with `macos-x64`, `linux-arm64`, or `linux-x64`. For **Windows x64**, use PowerShell:

```powershell
curl.exe -fL -o sheaf.zip https://nightly.link/preacherxp/sheaf/workflows/build-cli.yml/main/sheaf-windows-x64.zip
Expand-Archive sheaf.zip -DestinationPath .
.\sheaf.exe --help
```

You can also download the ZIP directly from a successful [Build CLI run](https://github.com/preacherxp/sheaf/actions/workflows/build-cli.yml).

## Usage

From the directory containing the executable:

```sh
./sheaf --list CC-1234                       # print PR URLs and titles; no browser or file
./sheaf CC-1234                              # open .sheaf/CC-1234.html
./sheaf 'acme/api#1, acme/web#2'             # checklist from explicit links; no token needed
```

On Windows, run `.\sheaf.exe` instead. On macOS or Linux, use `chmod +x sheaf` if your download did not preserve the executable bit. You can move the executable anywhere; snapshots are written in the directory you run it from.

Ticket search needs a GitHub token with read access to the repositories you want to search. Set `SHEAF_TOKEN` or `GH_TOKEN` in your shell, or use an existing `gh` login. GitHub CLI is optional. Sheaf searches PR **titles** in all states, matches the whole key case-insensitively, and paginates up to GitHub’s 1,000-candidate limit.

Check off a PR in the snapshot with a click or **Space**. Progress stays in the browser when local storage is available. The last check sends a ripple across the glass; reduced-motion mode skips it. WebGPU is optional. Rerun the CLI for fresh results.

The saved file contains no token, but anyone you send it to can read the captured titles and repository names, including private ones. To remove Sheaf, delete the executable and any snapshots you no longer want.

## Development

```sh
node --test                      # parser, search and snapshot tests
bun scripts/build-cli.mjs        # build dist/sheaf for this machine (Bun 1.4.4)
./dist/sheaf --help
```

The executable embeds the renderer and artwork. Only maintainers need Bun to build it. To target another machine, pass an output path and a Bun compile target, for example `bun scripts/build-cli.mjs dist/sheaf-linux-x64 bun-linux-x64`.

To edit the optional vgpu effects, run `npm ci --prefix scripts/art`, then `npm run build:page --prefix scripts/art`. Rebuild the executable to include the updated renderer.

## License

[MIT](LICENSE)
