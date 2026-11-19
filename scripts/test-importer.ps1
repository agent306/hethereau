<#
.SYNOPSIS
    End-to-end verification test for public/import-nte.ps1.
    Synthesizes a real PCAPNG file containing bit-shifted Monopoly UDP packets,
    NIC-duplicated packets, Fork/Arc UDP packets, and VLAN-tagged Mystery Box packets,
    then runs import-nte.ps1 -ReplayPcap -JsonOnly and verifies every decoded field.
#>
param(
    [switch]$EmitJson
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
$importerPath = Join-Path $repoRoot "public\import-nte.ps1"
$pcapPath = Join-Path $env:TEMP "nte-synthetic-test.pcapng"

# Helper functions to assemble Unreal binary structs & PCAPNG frames
function Write-U16BE([IO.MemoryStream]$ms, [uint16]$v) {
    $ms.WriteByte([byte](($v -shr 8) -band 0xFF))
    $ms.WriteByte([byte]($v -band 0xFF))
}
function Write-U16LE([IO.MemoryStream]$ms, [uint16]$v) {
    $ms.WriteByte([byte]($v -band 0xFF))
    $ms.WriteByte([byte](($v -shr 8) -band 0xFF))
}
function Write-U32LE([IO.MemoryStream]$ms, [uint32]$v) {
    $b = [BitConverter]::GetBytes($v)
    $ms.Write($b, 0, 4)
}
function Write-U64LE([IO.MemoryStream]$ms, [uint64]$v) {
    $b = [BitConverter]::GetBytes($v)
    $ms.Write($b, 0, 8)
}
function Write-UeString([IO.MemoryStream]$ms, [string]$s) {
    $raw = [Text.Encoding]::UTF8.GetBytes($s)
    Write-U32LE $ms ([uint32]($raw.Length + 1))
    $ms.Write($raw, 0, $raw.Length)
    $ms.WriteByte(0)
}
function DateTo-DotNetTicks([string]$isoUtc) {
    $dt = [DateTime]::ParseExact($isoUtc, "yyyy-MM-dd HH:mm:ss", [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal)
    return [uint64]$dt.Ticks
}

function BitShift-Payload([byte[]]$raw, [int]$prefixLen, [int]$shiftBits) {
    # Inverse of DecodeShiftedBytes(data, byteOff=prefixLen, bitShift=shiftBits):
    # We place `raw` shifted LEFT by shiftBits starting after prefixLen bytes.
    $outLen = $prefixLen + $raw.Length + 1
    $out = New-Object byte[] $outLen
    for ($i = 0; $i -lt $prefixLen; $i++) { $out[$i] = [byte](0xA0 + $i) }
    for ($i = 0; $i -lt $raw.Length; $i++) {
        $v = [int]$raw[$i]
        $out[$prefixLen + $i] = [byte]($out[$prefixLen + $i] -bor (($v -shl $shiftBits) -band 0xFF))
        $out[$prefixLen + $i + 1] = [byte]($out[$prefixLen + $i + 1] -bor (($v -shr (8 - $shiftBits)) -band 0xFF))
    }
    return $out
}

function Wrap-EthernetIpv4Udp([byte[]]$udpPayload, [switch]$WithVlan) {
    $ms = New-Object IO.MemoryStream
    # Ethernet dst + src MACs (12 bytes)
    $macs = [byte[]]@(0x00,0x11,0x22,0x33,0x44,0x55, 0x66,0x77,0x88,0x99,0xAA,0xBB)
    $ms.Write($macs, 0, 12)
    if ($WithVlan) {
        Write-U16BE $ms 0x8100
        Write-U16BE $ms 0x000A # VLAN 10
    }
    Write-U16BE $ms 0x0800 # IPv4

    $udpLen = [uint16](8 + $udpPayload.Length)
    $ipTotalLen = [uint16](20 + $udpLen)

    # IPv4 header (20 bytes)
    $ms.WriteByte(0x45) # v4, IHL=5
    $ms.WriteByte(0x00)
    Write-U16BE $ms $ipTotalLen
    Write-U16BE $ms 0x1234
    Write-U16BE $ms 0x4000
    $ms.WriteByte(64)
    $ms.WriteByte(17) # UDP
    Write-U16BE $ms 0x0000
    $ips = [byte[]]@(192,168,1,10, 10,20,30,40)
    $ms.Write($ips, 0, 8)

    # UDP header (8 bytes)
    Write-U16BE $ms 23003
    Write-U16BE $ms 54321
    Write-U16BE $ms $udpLen
    Write-U16BE $ms 0x0000
    $ms.Write($udpPayload, 0, $udpPayload.Length)

    return $ms.ToArray()
}

function Write-PcapngBlock([IO.MemoryStream]$ms, [uint32]$type, [byte[]]$body) {
    $pad = (4 - ($body.Length % 4)) % 4
    $totalLen = [uint32](12 + $body.Length + $pad)
    Write-U32LE $ms $type
    Write-U32LE $ms $totalLen
    $ms.Write($body, 0, $body.Length)
    for ($i = 0; $i -lt $pad; $i++) { $ms.WriteByte(0) }
    Write-U32LE $ms $totalLen
}

function Write-PcapngEpb([IO.MemoryStream]$ms, [byte[]]$frame) {
    $body = New-Object IO.MemoryStream
    Write-U32LE $body 0 # interface id
    Write-U32LE $body 0 # ts high
    Write-U32LE $body 1000 # ts low
    Write-U32LE $body ([uint32]$frame.Length) # cap len
    Write-U32LE $body ([uint32]$frame.Length) # orig len
    $body.Write($frame, 0, $frame.Length)
    Write-PcapngBlock $ms 0x00000006 ($body.ToArray())
}

# 1. Build Monopoly block (3 rows: dice S-rank + Points Gift + Slumberland) with valid envelope, shifted 5 bits!
$monoRows = New-Object IO.MemoryStream
# Row 1: Nanally (1010), dice=4, CardPool_Character, Lottery_Nanali
Write-U32LE $monoRows 4
Write-UeString $monoRows "1010,1"
Write-U32LE $monoRows 0
Write-U32LE $monoRows 10
Write-UeString $monoRows "Dice_ticket_01"
Write-UeString $monoRows "RollResult"
Write-UeString $monoRows "CardPool_Character"
Write-U64LE $monoRows (DateTo-DotNetTicks "2026-05-01 12:30:00")
Write-UeString $monoRows "Lottery_Nanali"

# Row 2: Points Gift (raw_roll=0), DiceNormal, no trailing lottery_id
Write-U32LE $monoRows 0
Write-UeString $monoRows "DiceNormal,1"
Write-U32LE $monoRows 0
Write-U32LE $monoRows 0
Write-UeString $monoRows ""
Write-UeString $monoRows "CardPool_Character"
Write-U64LE $monoRows (DateTo-DotNetTicks "2026-05-01 12:30:00")

# Row 3: Slumberland (raw_roll=0xFFFFFFFF), Adler (1033), Lottery_Nanali
Write-U32LE $monoRows ([uint32]::MaxValue)
Write-UeString $monoRows "1033,1"
Write-U32LE $monoRows 0
Write-U32LE $monoRows 2
Write-UeString $monoRows "Dice_ticket_02"
Write-UeString $monoRows "CardPool_Character"
Write-U64LE $monoRows (DateTo-DotNetTicks "2026-05-01 12:29:50")
Write-UeString $monoRows "Lottery_Nanali"

$monoRowBytes = $monoRows.ToArray()
$monoBlock = New-Object IO.MemoryStream
# Envelope (26 bytes before marker): proto(4), query(4), page(4), kind(4), pool_token(4), footer(4), pad(2)
Write-U32LE $monoBlock 0x03000000
Write-U32LE $monoBlock 0x00000001 # query_high = false
Write-U32LE $monoBlock 0x00000001 # page = 1 -> segment = 1
Write-U32LE $monoBlock 527        # MONOPOLY_BLOCK_KIND
Write-U32LE $monoBlock 101        # pool_token
Write-U32LE $monoBlock 1774080    # MONOPOLY_FOOTER
$monoBlock.WriteByte(0); $monoBlock.WriteByte(0)
# Marker + NUL + frame header (flags 4, declared_size 4, row_count 4)
$mMarker = [Text.Encoding]::ASCII.GetBytes("FMonopolyLotteryRecordData")
$monoBlock.Write($mMarker, 0, $mMarker.Length)
$monoBlock.WriteByte(0)
Write-U32LE $monoBlock 0
Write-U32LE $monoBlock ([uint32]($monoRowBytes.Length + 4))
Write-U32LE $monoBlock 3
$monoBlock.Write($monoRowBytes, 0, $monoRowBytes.Length)

# Bit-shift the entire Monopoly payload by 5 bits at byte offset 8!
$monoShiftedPayload = BitShift-Payload ($monoBlock.ToArray()) 8 5

# 2. Build Fork / Arc block (2 rows, raw-aligned) with valid envelope
$forkRows = New-Object IO.MemoryStream
Write-UeString $forkRows "fork_TigerTally,1"
Write-UeString $forkRows "ForkLottery_Nanali"
Write-U64LE $forkRows (DateTo-DotNetTicks "2026-05-02 09:15:00")
Write-UeString $forkRows "fork_nonos,1"
Write-UeString $forkRows "ForkLottery_Nanali"
Write-U64LE $forkRows (DateTo-DotNetTicks "2026-05-02 09:15:00")

$forkRowBytes = $forkRows.ToArray()
$forkBlock = New-Object IO.MemoryStream
# Envelope (17 bytes before marker): proto(4), query(4), page(4), kind(4), pad(1)
Write-U32LE $forkBlock 0x03000000
Write-U32LE $forkBlock 0x00000001
Write-U32LE $forkBlock 0x00000001
Write-U32LE $forkBlock 5906
$forkBlock.WriteByte(0)
$fMarker = [Text.Encoding]::ASCII.GetBytes("FForkLotteryRecordData")
$forkBlock.Write($fMarker, 0, $fMarker.Length)
$forkBlock.WriteByte(0)
Write-U32LE $forkBlock 0
Write-U32LE $forkBlock ([uint32]($forkRowBytes.Length + 4))
Write-U32LE $forkBlock 2
$forkBlock.Write($forkRowBytes, 0, $forkRowBytes.Length)
$forkPayload = $forkBlock.ToArray()

# 3. Build Mystery Box block (1 row, inside VLAN-tagged Ethernet frame)
$mbBlock = New-Object IO.MemoryStream
$gMarker = [Text.Encoding]::ASCII.GetBytes("FGashaponLotteryRecordData")
$mbBlock.Write($gMarker, 0, $gMarker.Length)
$mbBlock.WriteByte(0)
Write-U32LE $mbBlock 0
Write-U32LE $mbBlock 64
Write-U32LE $mbBlock 1
Write-UeString $mbBlock "vehicle039"
Write-U32LE $mbBlock 1
$mbBlock.WriteByte(1)
Write-U64LE $mbBlock (DateTo-DotNetTicks "2026-07-08 19:09:33")
$mbPayload = $mbBlock.ToArray()

# Assemble PCAPNG file (SHB + IDB + EPBs including a NIC-duplicate of packet 1!)
$pcap = New-Object IO.MemoryStream
# SHB
$shb = New-Object IO.MemoryStream
Write-U32LE $shb 0x1A2B3C4D
Write-U16LE $shb 1; Write-U16LE $shb 0
Write-U64LE $shb ([uint64]::MaxValue)
Write-PcapngBlock $pcap 0x0A0D0D0A ($shb.ToArray())
# IDB (Ethernet = linktype 1)
$idb = New-Object IO.MemoryStream
Write-U16LE $idb 1; Write-U16LE $idb 0
Write-U32LE $idb 65535
Write-PcapngBlock $pcap 0x00000001 ($idb.ToArray())

$frame1 = Wrap-EthernetIpv4Udp $monoShiftedPayload
$frame2 = Wrap-EthernetIpv4Udp $forkPayload
$frame3 = Wrap-EthernetIpv4Udp $mbPayload -WithVlan

Write-PcapngEpb $pcap $frame1
Write-PcapngEpb $pcap $frame1 # Intentional duplicate simulating pktmon --comp nics!
Write-PcapngEpb $pcap $frame2
Write-PcapngEpb $pcap $frame3

[IO.File]::WriteAllBytes($pcapPath, $pcap.ToArray())

try {
    $rawJson = & $importerPath -ReplayPcap $pcapPath -JsonOnly -NoClipboard -NoFile
    $parsed = ($rawJson -join "`n") | ConvertFrom-Json

    $list = @($parsed.nte.list)
    if ($list.Count -ne 6) {
        throw "Expected 6 deduplicated records (3 monopoly + 2 fork + 1 mystery_box), got $($list.Count)"
    }
    if ($list[0].item_id -ne "1010" -or $list[0].roll_points -ne 4 -or $list[0].lottery_id -ne "Lottery_Nanali") {
        throw "Row 0 mismatch: $($list[0] | ConvertTo-Json -Compress)"
    }
    if ($list[1].item_id -ne "DiceNormal" -or $list[1].roll_label -ne "Points Gift") {
        throw "Row 1 mismatch: $($list[1] | ConvertTo-Json -Compress)"
    }
    if ($list[2].item_id -ne "1033" -or $list[2].roll_label -ne "Slumberland") {
        throw "Row 2 mismatch: $($list[2] | ConvertTo-Json -Compress)"
    }
    if ($list[3].item_id -ne "fork_TigerTally" -or $list[3].pool_id -ne "ForkLottery_Nanali") {
        throw "Row 3 mismatch: $($list[3] | ConvertTo-Json -Compress)"
    }
    if ($list[4].item_id -ne "fork_nonos") {
        throw "Row 4 mismatch: $($list[4] | ConvertTo-Json -Compress)"
    }
    if ($list[5].item_id -ne "vehicle039" -or $list[5].pool_id -ne "Gashapon_MysteryBox") {
        throw "Row 5 mismatch: $($list[5] | ConvertTo-Json -Compress)"
    }

    # Verify deterministic record_id stability across a second run
    $rawJson2 = & $importerPath -ReplayPcap $pcapPath -JsonOnly -NoClipboard -NoFile
    $parsed2 = ($rawJson2 -join "`n") | ConvertFrom-Json
    for ($i = 0; $i -lt 6; $i++) {
        if ($parsed.nte.list[$i].record_id -ne $parsed2.nte.list[$i].record_id) {
            throw "Non-deterministic record_id at index $i"
        }
    }

    if ($EmitJson) {
        Write-Output ($rawJson -join "`n")
    } else {
        Write-Host "[PASS] Zero-install pktmon importer decoded all 6 records (bit-shifted Monopoly + NIC dedupe + Fork + VLAN MysteryBox) with deterministic IDs!" -ForegroundColor Green
    }
} finally {
    Remove-Item -LiteralPath $pcapPath -Force -ErrorAction SilentlyContinue
}
