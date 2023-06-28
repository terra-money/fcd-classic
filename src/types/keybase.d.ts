declare namespace Keybase {
  export interface Root {
    status: Status
    them: Them[]
  }

  export interface Status {
    code: number
    name: string
  }

  export interface Them {
    id: string
    basics: Basics
    profile: Profile
    public_keys: PublicKeys
    proofs_summary: ProofsSummary
    cryptocurrency_addresses: {}
    pictures: Pictures
    sigs: Sigs
    devices: Devices
    stellar: Stellar
  }

  export interface Basics {
    username: string
    ctime: number
    mtime: number
    id_version: number
    track_version: number
    last_id_change: number
    username_cased: string
    status: number
    salt: string
    eldest_seqno: number
  }

  export interface Profile {
    mtime: any
    full_name: string
    location: any
    bio: any
  }

  export interface PublicKeys {
    primary: Primary
    all_bundles: string[]
    subkeys: string[]
    sibkeys: string[]
    families: Families
    eldest_kid: string
    eldest_key_fingerprint: string
    pgp_public_keys: string[]
  }

  export interface Primary {
    kid: string
    key_type: number
    bundle: string
    mtime: number
    ctime: number
    ukbid: string
    key_fingerprint: string
    key_bits: number
    key_algo: number
    signing_kid: string
    key_level: number
    etime: any
    eldest_kid: string
    status: number
    self_signed: boolean
  }

  export interface Families {
    [key: string]: string[]
  }

  export interface ProofsSummary {
    by_presentation_group: ByPresentationGroup
    by_sig_id: BySigId
    all: Proof[]
    has_web: boolean
  }

  export interface ByPresentationGroup {
    twitter: Proof[]
    github: Proof[]
  }

  export interface BySigId {
    [key: string]: Proof
  }

  export interface Proof {
    proof_type: string
    nametag: string
    state: number
    service_url: string
    proof_url: string
    sig_id: string
    proof_id: string
    human_url: string
    presentation_group: string
    presentation_tag: string
  }

  export interface Pictures {
    primary: PrimaryPicture
  }

  export interface PrimaryPicture {
    url: string
    source: any
  }

  export interface Sigs {
    last: Last
  }

  export interface Last {
    sig_id: string
    seqno: number
    payload_hash: string
  }

  export interface Devices {
    [key: string]: Device
  }

  export interface Device {
    type: string
    ctime: number
    mtime: number
    name: string
    status: number
    keys: Key[]
  }

  export interface Key {
    kid: string
    key_role: number
    sig_id: string
  }

  export interface Stellar {
    hidden: boolean
    primary: {
      account_id: string
    }
  }
}
