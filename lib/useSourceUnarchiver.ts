import { Unarchiver, TarballUnarchiver, ZipUnarchiver } from "./Unarchiver.ts"
import { Verbosity } from "types"
import { useConfig } from "hooks"
import run from "hooks/useRun.ts"
import Path from "path"

//FIXME assuming strip 1 on components is going to trip people up

interface Options {
  dstdir: Path    /// must be empty
  zipfile: Path
  stripComponents?: number
}

interface Response {
  unarchive(opts: Options): Promise<Path>
}

export default function useSourceUnarchiver(): Response {
  const unarchive = async (opts: Options) => {
    const { verbosity } = useConfig()

    let unarchiver: Unarchiver
    if (ZipUnarchiver.supports(opts.zipfile)) {
      const stripComponents = opts.stripComponents ?? 0
      const needsTmpdir = stripComponents > 0
      const dstdir = needsTmpdir ? Path.mktemp({}) : opts.dstdir.mkpath()
      try {
        unarchiver = new ZipUnarchiver({ verbosity, ...opts, dstdir })
        if (needsTmpdir) {
          throw new Error("unimpl")
        }
      } finally {
        if (needsTmpdir) {
          if (verbosity >= Verbosity.debug) {
            dstdir.rm()
          } else {
            console.debug({ leaving: dstdir })
          }
        }
      }
    } else if (TarballUnarchiver.supports(opts.zipfile) || opts.stripComponents !== undefined) {
      //FIXME we need to determine file type from the magic bytes
      // rather than assume tarball if not zip
      opts.dstdir.mkpath()
      unarchiver = new TarballUnarchiver({ verbosity, ...opts })
    } else {
      // the “tarball” is actually just a single file like beyondgrep.com
      return opts.zipfile.cp({ into: opts.dstdir.mkpath() })
    }

    const cmd = unarchiver.args()

    await run({ cmd })

    return opts.dstdir
  }
  return { unarchive }
}
