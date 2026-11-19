<#
.SYNOPSIS
    Zero-Install Neverness to Everness (NTE) Pull History Importer using built-in Windows pktmon.

.DESCRIPTION
    Passively captures NTE UDP and game-port TCP gacha history packets using Microsoft's built-in
    pktmon.exe (pre-installed on Windows 10 2004+ and Windows 11). Decodes Monopoly (Limited &
    Standard Boards), Arc Research (Fork Lottery), and Mystery Box history records locally in
    memory, copies sanitized JSON to your clipboard, and deletes temporary capture files.

    Zero downloads, zero third-party drivers, zero memory injection, zero packet modification.

.EXAMPLE
    & ([scriptblock]::Create((irm 'https://hethereau.pages.dev/import-nte.ps1'))) -SourceUrl 'https://hethereau.pages.dev/import-nte.ps1'

.EXAMPLE
    .\import-nte.ps1 -ReplayPcap .\sample.pcapng -JsonOnly
#>
param(
    [string]$ReplayPcap = "",
    [string]$OutFile = "",
    [switch]$NoFilter,
    [switch]$AutoPage,
    [int]$MaxPages = 200,
    [int]$ClickDelayMs = 320,
    [switch]$KeepCapture,
    [switch]$NoClipboard,
    [switch]$NoFile,
    [switch]$JsonOnly,
    [string]$SourceUrl = ""
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# 1. Self-Elevation Helper (Only required for live pktmon capture)
# ---------------------------------------------------------------------------
function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if ([string]::IsNullOrWhiteSpace($ReplayPcap) -and -not (Test-IsAdmin)) {
    Write-Host ""
    Write-Host "  [NTE Zero-Install Importer]" -ForegroundColor Cyan
    Write-Host "  Windows built-in 'pktmon.exe' requires Administrator permission to capture packets." -ForegroundColor Yellow
    Write-Host "  Press [ENTER] to relaunch as Administrator, or any other key to cancel..." -ForegroundColor Gray
    $key = [Console]::ReadKey($true).Key
    if ($key -ne "Enter") {
        Write-Host "  Cancelled." -ForegroundColor Red
        return
    }

    $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit")
    $targetScript = $PSCommandPath
    if ([string]::IsNullOrWhiteSpace($targetScript)) {
        $tmpScript = Join-Path $env:TEMP "nte-zero-install-importer.ps1"
        if (-not [string]::IsNullOrWhiteSpace($SourceUrl)) {
            Invoke-WebRequest -Uri $SourceUrl -OutFile $tmpScript -UseBasicParsing
        } elseif ($MyInvocation.MyCommand -and $MyInvocation.MyCommand.ScriptBlock) {
            [IO.File]::WriteAllText($tmpScript, $MyInvocation.MyCommand.ScriptBlock.ToString(), (New-Object Text.UTF8Encoding($false)))
        } else {
            Write-Host "  Could not determine script path for elevation. Please open PowerShell as Administrator and run the command again." -ForegroundColor Red
            return
        }
        $targetScript = $tmpScript
    }

    $argList += @("-File", "`"$targetScript`"")
    if ($NoFilter) { $argList += "-NoFilter" }
    if ($AutoPage) {
        $argList += "-AutoPage"
        $argList += @("-MaxPages", $MaxPages.ToString())
        $argList += @("-ClickDelayMs", $ClickDelayMs.ToString())
    }
    if ($KeepCapture) { $argList += "-KeepCapture" }
    if ($NoClipboard) { $argList += "-NoClipboard" }
    if ($NoFile) { $argList += "-NoFile" }
    if ($JsonOnly) { $argList += "-JsonOnly" }
    if (-not [string]::IsNullOrWhiteSpace($OutFile)) { $argList += @("-OutFile", "`"$OutFile`"") }

    Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $argList
    return
}

# ---------------------------------------------------------------------------
# 2. Inline C# 5 PCAPNG + 802.11/Ethernet/RawIP + Bit-Shifted NTE Decoder
#    Compatible with both Windows PowerShell 5.1 (.NET 4.x) and PowerShell 7+
# ---------------------------------------------------------------------------
$decoderSource = @'
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace NteZeroInstallV2
{
    public class DecodedRow
    {
        public string RecordId;
        public int SourceOrder;
        public string RecordType;
        public long Ticks;
        public string Time;
        public string PoolId;
        public string LotteryId;
        public string ItemId;
        public uint Count;
        public bool HasRollPoints;
        public uint RollPoints;
        public string RollLabelId;
        public string SecondaryItemId;
        public bool HasSecondaryCount;
        public uint SecondaryCount;

        public string StreamKey;
        public bool HasEnvelope;
        public uint PageIndex;
        public bool QueryHigh;
        public uint SegmentIndex;
        public int PacketIndex;
        public string ViewName;
    }

    public class DecodeSummary
    {
        public int PacketsScanned;
        public int UdpPayloadsScanned;
        public int TcpPayloadsScanned;
        public int BlocksDecoded;
        public int UniqueRecords;
        public List<int> LinkTypesSeen = new List<int>();
        public List<DecodedRow> Records = new List<DecodedRow>();
        public List<string> Warnings = new List<string>();
    }

    internal class EnvelopeInfo
    {
        public string RecordType;
        public string StreamKey;
        public uint PageIndex;
        public bool QueryHigh;
        public uint SegmentIndex;
    }

    internal class ParsedBlock
    {
        public string RecordType;
        public EnvelopeInfo Envelope;
        public List<DecodedRow> Rows = new List<DecodedRow>();
        public string Signature;
    }

    internal class MonopolyCore
    {
        public uint RawRollPoints;
        public string ItemSpec;
        public uint SecondaryCount;
        public string SecondaryItem;
        public string PoolId;
        public ulong Ticks;
    }

    internal class SegmentData
    {
        public uint Index;
        public List<DecodedRow> Rows;
        public string Signature;
    }

    internal class GenerationData
    {
        public int Index;
        public SortedDictionary<uint, SegmentData> Segments = new SortedDictionary<uint, SegmentData>();
    }

    internal class StreamState
    {
        public List<GenerationData> Generations = new List<GenerationData>();
    }

    public static class NtePktmonDecoderV2
    {
        private const long DOTNET_EPOCH_TICKS = 621355968000000000L;
        private const long TICKS_PER_SECOND = 10000000L;
        private const long MIN_UNIX_SECONDS = 1500000000L;
        private const long MAX_UNIX_SECONDS = 4102444800L;
        private const uint MAX_ROWS_PER_BLOCK = 100;
        private const int MAX_STRING_LEN = 256;
        private const int MAX_SHIFTED_PADDING_SHORTFALL = 3;

        private const uint PROTOCOL_CONSTANT = 0x03000000u;
        private const uint MONOPOLY_BLOCK_KIND = 527u;
        private const uint FORK_BLOCK_KIND = 5906u;
        private const uint MONOPOLY_FOOTER = 1774080u;

        private static readonly byte[] MONOPOLY_MARKER = Encoding.ASCII.GetBytes("FMonopolyLotteryRecordData");
        private static readonly byte[] FORK_MARKER = Encoding.ASCII.GetBytes("FForkLotteryRecordData");
        private static readonly byte[] MYSTERY_MARKER = Encoding.ASCII.GetBytes("FGashaponLotteryRecordData");

        public static DecodeSummary DecodePcapFile(string path)
        {
            byte[] fileBytes = File.ReadAllBytes(path);
            DecodeSummary summary = new DecodeSummary();

            List<string> streamOrder = new List<string>();
            Dictionary<string, StreamState> streams = new Dictionary<string, StreamState>();
            List<DecodedRow> legacyRows = new List<DecodedRow>();
            HashSet<string> legacyBlockSigs = new HashSet<string>();

            List<byte[]> l4Payloads = new List<byte[]>();
            Dictionary<string, Dictionary<uint, byte[]>> tcpStreams = new Dictionary<string, Dictionary<uint, byte[]>>();
            HashSet<int> linkTypesSet = new HashSet<int>();

            ExtractL4Payloads(fileBytes, l4Payloads, tcpStreams, linkTypesSet, summary);
            foreach (int lt in linkTypesSet) summary.LinkTypesSeen.Add(lt);
            summary.LinkTypesSeen.Sort();

            // 1. Scan individual UDP & TCP packet payloads
            int pIdx = 0;
            for (int i = 0; i < l4Payloads.Count; i++)
            {
                byte[] payload = l4Payloads[i];
                if (payload == null || payload.Length < 32) continue;

                List<ParsedBlock> blocks = ScanPayload(payload, pIdx++, summary.Warnings);
                for (int bIdx = 0; bIdx < blocks.Count; bIdx++)
                {
                    summary.BlocksDecoded++;
                    AddBlockToAssembler(blocks[bIdx], streamOrder, streams, legacyRows, legacyBlockSigs);
                }
            }

            // 2. Scan reassembled TCP streams (handles multi-segment responses)
            foreach (KeyValuePair<string, Dictionary<uint, byte[]>> kv in tcpStreams)
            {
                byte[] reassembled = ReassembleTcpStream(kv.Value);
                if (reassembled == null || reassembled.Length < 32) continue;

                List<ParsedBlock> blocks = ScanPayload(reassembled, pIdx++, summary.Warnings);
                for (int bIdx = 0; bIdx < blocks.Count; bIdx++)
                {
                    summary.BlocksDecoded++;
                    AddBlockToAssembler(blocks[bIdx], streamOrder, streams, legacyRows, legacyBlockSigs);
                }
            }

            List<DecodedRow> assembled = AssembleAll(streamOrder, streams, legacyRows, summary.Warnings);
            AssignStableRecordIds(assembled);

            for (int i = 0; i < assembled.Count; i++)
            {
                assembled[i].SourceOrder = i;
            }

            summary.Records = assembled;
            summary.UniqueRecords = assembled.Count;
            return summary;
        }

        private static byte[] ReassembleTcpStream(Dictionary<uint, byte[]> segments)
        {
            if (segments == null || segments.Count < 2) return null;
            List<uint> seqs = new List<uint>(segments.Keys);
            seqs.Sort();
            int total = 0;
            for (int i = 0; i < seqs.Count; i++)
            {
                total += segments[seqs[i]].Length;
                if (total > 8 * 1024 * 1024) break; // safety cap 8 MB per stream
            }
            using (MemoryStream ms = new MemoryStream(Math.Min(total, 8 * 1024 * 1024)))
            {
                for (int i = 0; i < seqs.Count; i++)
                {
                    byte[] seg = segments[seqs[i]];
                    if (ms.Length + seg.Length > 8 * 1024 * 1024) break;
                    ms.Write(seg, 0, seg.Length);
                }
                return ms.ToArray();
            }
        }

        // -------------------------------------------------------------------
        // PCAPNG & Legacy PCAP Extraction
        // -------------------------------------------------------------------
        private static void ExtractL4Payloads(
            byte[] data,
            List<byte[]> payloads,
            Dictionary<string, Dictionary<uint, byte[]>> tcpStreams,
            HashSet<int> linkTypesSet,
            DecodeSummary summary)
        {
            if (data.Length < 24) return;

            uint magic = ReadU32LE(data, 0);
            if (magic == 0x0A0D0D0Au)
            {
                ParsePcapng(data, payloads, tcpStreams, linkTypesSet, summary);
            }
            else if (magic == 0xA1B2C3D4u || magic == 0xD4C3B2A1u)
            {
                ParseLegacyPcap(data, magic == 0xD4C3B2A1u, payloads, tcpStreams, linkTypesSet, summary);
            }
            else
            {
                summary.Warnings.Add("Unrecognized capture magic 0x" + magic.ToString("X8") + "; scanning raw file.");
                payloads.Add(data);
            }
        }

        private static void ParsePcapng(
            byte[] data,
            List<byte[]> payloads,
            Dictionary<string, Dictionary<uint, byte[]>> tcpStreams,
            HashSet<int> linkTypesSet,
            DecodeSummary summary)
        {
            List<ushort> interfaceLinkTypes = new List<ushort>();
            int pos = 0;
            bool bigEndian = false;

            while (pos + 12 <= data.Length)
            {
                uint blockType = bigEndian ? ReadU32BE(data, pos) : ReadU32LE(data, pos);
                if (blockType == 0x0A0D0D0Au)
                {
                    if (pos + 28 > data.Length) break;
                    uint bom = ReadU32LE(data, pos + 8);
                    bigEndian = (bom == 0x4D3C2B1Au);
                    interfaceLinkTypes.Clear();
                }

                uint blockLen = bigEndian ? ReadU32BE(data, pos + 4) : ReadU32LE(data, pos + 4);
                if (blockLen < 12 || pos + blockLen > data.Length) break;

                if (blockType == 0x00000001u && blockLen >= 20)
                {
                    ushort linkType = bigEndian ? ReadU16BE(data, pos + 8) : ReadU16LE(data, pos + 8);
                    interfaceLinkTypes.Add(linkType);
                    linkTypesSet.Add((int)linkType);
                }
                else if (blockType == 0x00000006u && blockLen >= 32)
                {
                    uint ifaceId = bigEndian ? ReadU32BE(data, pos + 8) : ReadU32LE(data, pos + 8);
                    uint capLen = bigEndian ? ReadU32BE(data, pos + 20) : ReadU32LE(data, pos + 20);
                    int pktStart = pos + 28;
                    if (capLen > 0 && pktStart + capLen <= pos + blockLen - 4)
                    {
                        ushort linkType = (ifaceId < (uint)interfaceLinkTypes.Count)
                            ? interfaceLinkTypes[(int)ifaceId]
                            : (ushort)1;
                        summary.PacketsScanned++;
                        ExtractFromFrame(data, pktStart, (int)capLen, linkType, payloads, tcpStreams, summary);
                    }
                }
                else if (blockType == 0x00000003u && blockLen >= 16)
                {
                    int pktStart = pos + 12;
                    int capLen = (int)blockLen - 16;
                    if (capLen > 0 && pktStart + capLen <= data.Length)
                    {
                        ushort linkType = interfaceLinkTypes.Count > 0 ? interfaceLinkTypes[0] : (ushort)1;
                        summary.PacketsScanned++;
                        ExtractFromFrame(data, pktStart, capLen, linkType, payloads, tcpStreams, summary);
                    }
                }

                pos += (int)blockLen;
            }
        }

        private static void ParseLegacyPcap(
            byte[] data,
            bool bigEndian,
            List<byte[]> payloads,
            Dictionary<string, Dictionary<uint, byte[]>> tcpStreams,
            HashSet<int> linkTypesSet,
            DecodeSummary summary)
        {
            if (data.Length < 24) return;
            uint linkType = bigEndian ? ReadU32BE(data, 20) : ReadU32LE(data, 20);
            linkTypesSet.Add((int)linkType);
            int pos = 24;
            while (pos + 16 <= data.Length)
            {
                uint inclLen = bigEndian ? ReadU32BE(data, pos + 8) : ReadU32LE(data, pos + 8);
                pos += 16;
                if (inclLen == 0 || pos + inclLen > data.Length) break;
                summary.PacketsScanned++;
                ExtractFromFrame(data, pos, (int)inclLen, (ushort)linkType, payloads, tcpStreams, summary);
                pos += (int)inclLen;
            }
        }

        private static void ExtractFromFrame(
            byte[] buf,
            int offset,
            int len,
            ushort linkType,
            List<byte[]> payloads,
            Dictionary<string, Dictionary<uint, byte[]>> tcpStreams,
            DecodeSummary summary)
        {
            int frameEnd = offset + len;
            int ipOffset = FindIpOffset(buf, offset, len, linkType);

            if (ipOffset >= 0 && ipOffset < frameEnd)
            {
                if (TryExtractFromIp(buf, ipOffset, frameEnd, payloads, tcpStreams, summary))
                {
                    return;
                }
            }

            // Fallback: try raw IP at offset 14 or 0 (matches pktmon raw/tunnel edge cases)
            if (TryExtractFromIp(buf, offset + 14, frameEnd, payloads, tcpStreams, summary)) return;
            if (TryExtractFromIp(buf, offset, frameEnd, payloads, tcpStreams, summary)) return;
        }

        private static int FindIpOffset(byte[] buf, int offset, int len, ushort linkType)
        {
            int frameEnd = offset + len;
            if (linkType == 1) // Ethernet
            {
                if (len < 14) return -1;
                ushort etherType = ReadU16BE(buf, offset + 12);
                int l3 = offset + 14;
                while ((etherType == 0x8100 || etherType == 0x88A8 || etherType == 0x9100) && l3 + 4 <= frameEnd)
                {
                    etherType = ReadU16BE(buf, l3 + 2);
                    l3 += 4;
                }
                if (etherType == 0x8864 && l3 + 8 <= frameEnd)
                {
                    ushort pppProto = ReadU16BE(buf, l3 + 6);
                    l3 += 8;
                    if (pppProto == 0x0021) etherType = 0x0800;
                    else if (pppProto == 0x0057) etherType = 0x86DD;
                    else return -1;
                }
                if (etherType == 0x0800 || etherType == 0x86DD) return l3;
                return -1;
            }
            if (linkType == 105 || linkType == 127) // IEEE 802.11 Wi-Fi / Radiotap
            {
                int dot11 = offset;
                if (linkType == 127)
                {
                    if (len < 4) return -1;
                    ushort rtLen = ReadU16LE(buf, offset + 2);
                    dot11 = offset + rtLen;
                }
                if (dot11 + 24 > frameEnd) return -1;
                byte fc0 = buf[dot11];
                byte fc1 = buf[dot11 + 1];
                int frameType = (fc0 >> 2) & 0x03;
                if (frameType != 2) return -1; // Data frames only
                bool protectedFrame = (fc1 & 0x40) != 0;
                if (protectedFrame) return -1; // Encrypted at Wi-Fi link layer (unencrypted copy comes from NDIS/TCPIP)
                int subType = (fc0 >> 4) & 0x0F;
                bool isQos = (subType & 0x08) != 0;
                bool toDs = (fc1 & 0x01) != 0;
                bool fromDs = (fc1 & 0x02) != 0;
                bool order = (fc1 & 0x80) != 0;

                int hdrLen = 24;
                if (toDs && fromDs) hdrLen += 6;
                if (isQos) hdrLen += 2;
                if (isQos && order) hdrLen += 4;

                int llc = dot11 + hdrLen;
                // LLC/SNAP: AA AA 03 00 00 00 <EtherType>
                if (llc + 8 <= frameEnd && buf[llc] == 0xAA && buf[llc + 1] == 0xAA && buf[llc + 2] == 0x03)
                {
                    ushort ethType = ReadU16BE(buf, llc + 6);
                    if (ethType == 0x0800 || ethType == 0x86DD) return llc + 8;
                }
                return -1;
            }
            if (linkType == 101 || linkType == 12 || linkType == 228 || linkType == 229) // Raw IP
            {
                return offset;
            }
            if (linkType == 0) // BSD Loopback
            {
                return len >= 4 ? offset + 4 : -1;
            }
            if (linkType == 113) // Linux SLL
            {
                if (len < 16) return -1;
                ushort et = ReadU16BE(buf, offset + 14);
                return (et == 0x0800 || et == 0x86DD) ? offset + 16 : -1;
            }
            if (linkType == 276) // Linux SLL2
            {
                if (len < 20) return -1;
                ushort et = ReadU16BE(buf, offset);
                return (et == 0x0800 || et == 0x86DD) ? offset + 20 : -1;
            }
            return -1;
        }

        private static bool TryExtractFromIp(
            byte[] buf,
            int ipOffset,
            int frameEnd,
            List<byte[]> payloads,
            Dictionary<string, Dictionary<uint, byte[]>> tcpStreams,
            DecodeSummary summary)
        {
            if (ipOffset < 0 || ipOffset + 20 > frameEnd) return false;
            int version = (buf[ipOffset] >> 4) & 0x0F;
            int l4Offset = -1;
            int l4End = frameEnd;
            byte proto = 0;
            string ipPair = "";

            if (version == 4)
            {
                int ihl = (buf[ipOffset] & 0x0F) * 4;
                if (ihl < 20 || ipOffset + ihl > frameEnd) return false;
                int totalLen = ReadU16BE(buf, ipOffset + 2);
                if (totalLen < ihl) return false;
                if (ipOffset + totalLen <= frameEnd)
                {
                    l4End = ipOffset + totalLen;
                }
                proto = buf[ipOffset + 9];
                l4Offset = ipOffset + ihl;
                if (proto == 6)
                {
                    ipPair = ReadU32BE(buf, ipOffset + 12).ToString("X8") + ">" + ReadU32BE(buf, ipOffset + 16).ToString("X8");
                }
            }
            else if (version == 6)
            {
                if (ipOffset + 40 > frameEnd) return false;
                int payloadLen = ReadU16BE(buf, ipOffset + 4);
                if (ipOffset + 40 + payloadLen <= frameEnd)
                {
                    l4End = ipOffset + 40 + payloadLen;
                }
                proto = buf[ipOffset + 6];
                l4Offset = ipOffset + 40;
                int guard = 0;
                while ((proto == 0 || proto == 43 || proto == 44 || proto == 60) && l4Offset + 8 <= l4End && guard++ < 6)
                {
                    byte nextHdr = buf[l4Offset];
                    if (proto == 44) l4Offset += 8;
                    else l4Offset += (buf[l4Offset + 1] + 1) * 8;
                    proto = nextHdr;
                }
                if (proto == 6)
                {
                    ipPair = ReadU32BE(buf, ipOffset + 20).ToString("X8") + ">" + ReadU32BE(buf, ipOffset + 36).ToString("X8");
                }
            }
            else
            {
                return false;
            }

            if (l4Offset < 0 || l4Offset >= l4End) return false;

            if (proto == 17) // UDP
            {
                if (l4Offset + 8 > l4End) return false;
                int udpLen = ReadU16BE(buf, l4Offset + 4);
                if (udpLen < 8) return false;
                int payStart = l4Offset + 8;
                int payLen = (l4Offset + udpLen <= l4End) ? (udpLen - 8) : (l4End - payStart);
                if (payLen > 0)
                {
                    summary.UdpPayloadsScanned++;
                    if (payLen >= 32)
                    {
                        byte[] copy = new byte[payLen];
                        Buffer.BlockCopy(buf, payStart, copy, 0, payLen);
                        payloads.Add(copy);
                    }
                    return true;
                }
                return false;
            }
            if (proto == 6) // TCP
            {
                if (l4Offset + 20 > l4End) return false;
                ushort sport = ReadU16BE(buf, l4Offset);
                ushort dport = ReadU16BE(buf, l4Offset + 2);
                uint seq = ReadU32BE(buf, l4Offset + 4);
                int dataOff = ((buf[l4Offset + 12] >> 4) & 0x0F) * 4;
                if (dataOff < 20 || l4Offset + dataOff > l4End) return false;
                int payStart = l4Offset + dataOff;
                int payLen = l4End - payStart;
                if (payLen > 0)
                {
                    summary.TcpPayloadsScanned++;
                    byte[] copy = new byte[payLen];
                    Buffer.BlockCopy(buf, payStart, copy, 0, payLen);
                    if (payLen >= 32)
                    {
                        payloads.Add(copy);
                    }
                    // Skip TLS/HTTPS port 443 from TCP stream reassembly
                    if (sport != 443 && dport != 443)
                    {
                        string flowKey = ipPair + ":" + sport + ">" + dport;
                        Dictionary<uint, byte[]> segMap;
                        if (!tcpStreams.TryGetValue(flowKey, out segMap))
                        {
                            segMap = new Dictionary<uint, byte[]>();
                            tcpStreams[flowKey] = segMap;
                        }
                        byte[] existingSeg;
                        if (!segMap.TryGetValue(seq, out existingSeg) || copy.Length > existingSeg.Length)
                        {
                            segMap[seq] = copy;
                        }
                    }
                    return true;
                }
                return false;
            }
            return false;
        }

        // -------------------------------------------------------------------
        // Bit-Shifted Block Scanner & Structured Decoders
        // -------------------------------------------------------------------
        private static List<ParsedBlock> ScanPayload(byte[] payload, int packetIndex, List<string> warnings)
        {
            List<ParsedBlock> blocks = new List<ParsedBlock>();
            ParseView("raw", payload, packetIndex, blocks);

            for (int shift = 1; shift < 8; shift++)
            {
                if (payload.Length > 40 && ShiftedContainsAnyMarker(payload, 8, shift))
                {
                    byte[] shifted = DecodeShiftedBytes(payload, 8, shift, payload.Length - 8);
                    ParseView("shift8:" + shift, shifted, packetIndex, blocks);
                }
                else if (ShiftedContainsAnyMarker(payload, 0, shift))
                {
                    byte[] shifted = DecodeShiftedBytes(payload, 0, shift, payload.Length);
                    ParseView("shift0:" + shift, shifted, packetIndex, blocks);
                }
            }
            return blocks;
        }

        private static bool ShiftedContainsAnyMarker(byte[] data, int byteOff, int bitShift)
        {
            return ShiftedContainsMarker(data, byteOff, bitShift, MONOPOLY_MARKER)
                || ShiftedContainsMarker(data, byteOff, bitShift, FORK_MARKER)
                || ShiftedContainsMarker(data, byteOff, bitShift, MYSTERY_MARKER);
        }

        private static bool ShiftedContainsMarker(byte[] data, int byteOff, int bitShift, byte[] marker)
        {
            int count = data.Length - byteOff;
            if (count < marker.Length) return false;
            int maxStart = count - marker.Length;
            for (int start = 0; start <= maxStart; start++)
            {
                bool matched = true;
                for (int j = 0; j < marker.Length; j++)
                {
                    int bOff = byteOff + start + j;
                    byte val = (byte)(data[bOff] >> bitShift);
                    if (bOff + 1 < data.Length)
                    {
                        val |= (byte)(data[bOff + 1] << (8 - bitShift));
                    }
                    if (val != marker[j])
                    {
                        matched = false;
                        break;
                    }
                }
                if (matched) return true;
            }
            return false;
        }

        private static byte[] DecodeShiftedBytes(byte[] data, int byteOff, int bitShift, int count)
        {
            byte[] outBytes = new byte[count];
            for (int i = 0; i < count; i++)
            {
                int bOff = byteOff + i;
                if (bOff >= data.Length) break;
                byte val = (byte)(data[bOff] >> bitShift);
                if (bitShift != 0 && bOff + 1 < data.Length)
                {
                    val |= (byte)(data[bOff + 1] << (8 - bitShift));
                }
                outBytes[i] = val;
            }
            return outBytes;
        }

        private static void ParseView(string viewName, byte[] data, int packetIndex, List<ParsedBlock> blocks)
        {
            int pos = 0;
            while (pos < data.Length)
            {
                int found = IndexOfBytes(data, MONOPOLY_MARKER, pos);
                if (found < 0) break;
                ParsedBlock blk = TryParseMonopolyBlock(data, found, viewName, packetIndex);
                if (blk != null) blocks.Add(blk);
                pos = found + MONOPOLY_MARKER.Length;
            }

            pos = 0;
            while (pos < data.Length)
            {
                int found = IndexOfBytes(data, FORK_MARKER, pos);
                if (found < 0) break;
                ParsedBlock blk = TryParseForkBlock(data, found, viewName, packetIndex);
                if (blk != null) blocks.Add(blk);
                pos = found + FORK_MARKER.Length;
            }

            pos = 0;
            while (pos < data.Length)
            {
                int found = IndexOfBytes(data, MYSTERY_MARKER, pos);
                if (found < 0) break;
                ParsedBlock blk = TryParseMysteryBoxBlock(data, found, viewName, packetIndex);
                if (blk != null) blocks.Add(blk);
                pos = found + MYSTERY_MARKER.Length;
            }
        }

        private static EnvelopeInfo TryParseEnvelope(string recordType, byte[] data, int markerPos)
        {
            if (recordType == "monopoly")
            {
                if (markerPos < 26) return null;
                uint protoConst = ReadU32LE(data, markerPos - 26);
                uint queryRaw = ReadU32LE(data, markerPos - 22);
                uint pageRaw = ReadU32LE(data, markerPos - 18);
                uint blockKind = ReadU32LE(data, markerPos - 14);
                uint poolToken = ReadU32LE(data, markerPos - 10);
                uint footer = ReadU32LE(data, markerPos - 6);

                if (protoConst != PROTOCOL_CONSTANT || blockKind != MONOPOLY_BLOCK_KIND || footer != MONOPOLY_FOOTER)
                    return null;

                uint pageIndex = pageRaw & 0x7FFFFFFFu;
                bool queryHigh = (queryRaw & 0x80000000u) != 0;
                if (!queryHigh && pageIndex == 0) return null;
                uint segIdx = queryHigh ? (pageIndex * 2u) : (pageIndex * 2u - 1u);

                return new EnvelopeInfo
                {
                    RecordType = "monopoly",
                    StreamKey = "monopoly:" + poolToken.ToString(CultureInfo.InvariantCulture),
                    PageIndex = pageIndex,
                    QueryHigh = queryHigh,
                    SegmentIndex = segIdx
                };
            }
            else if (recordType == "fork")
            {
                if (markerPos < 17) return null;
                uint protoConst = ReadU32LE(data, markerPos - 17);
                uint queryRaw = ReadU32LE(data, markerPos - 13);
                uint pageRaw = ReadU32LE(data, markerPos - 9);
                uint blockKind = ReadU32LE(data, markerPos - 5);

                if (protoConst != PROTOCOL_CONSTANT || blockKind != FORK_BLOCK_KIND)
                    return null;

                uint pageIndex = pageRaw & 0x7FFFFFFFu;
                bool queryHigh = (queryRaw & 0x80000000u) != 0;
                if (!queryHigh && pageIndex == 0) return null;
                uint segIdx = queryHigh ? (pageIndex * 2u) : (pageIndex * 2u - 1u);

                return new EnvelopeInfo
                {
                    RecordType = "fork",
                    StreamKey = "fork",
                    PageIndex = pageIndex,
                    QueryHigh = queryHigh,
                    SegmentIndex = segIdx
                };
            }
            return null;
        }

        private static bool TryParseFrame(byte[] data, int markerPos, byte[] marker, string viewName, out int rowsStart, out int blockEnd, out uint rowCount)
        {
            rowsStart = 0;
            blockEnd = 0;
            rowCount = 0;

            int pos = markerPos + marker.Length;
            if (pos < data.Length && data[pos] == 0) pos++;
            if (pos + 12 > data.Length) return false;

            uint declaredSize = ReadU32LE(data, pos + 4);
            rowCount = ReadU32LE(data, pos + 8);
            if (rowCount == 0 || rowCount > MAX_ROWS_PER_BLOCK) return false;
            if (declaredSize < 4) return false;

            rowsStart = pos + 12;
            long computedEnd = (long)rowsStart + (long)(declaredSize - 4);
            int allowedShortfall = viewName == "raw" ? 0 : MAX_SHIFTED_PADDING_SHORTFALL;
            if (computedEnd < rowsStart || computedEnd > (long)data.Length + allowedShortfall)
                return false;

            blockEnd = (int)Math.Min(computedEnd, data.Length);
            return true;
        }

        private static ParsedBlock TryParseMonopolyBlock(byte[] data, int markerPos, string viewName, int packetIndex)
        {
            EnvelopeInfo env = TryParseEnvelope("monopoly", data, markerPos);
            int rowsStart, blockEnd;
            uint rowCount;
            if (!TryParseFrame(data, markerPos, MONOPOLY_MARKER, viewName, out rowsStart, out blockEnd, out rowCount))
                return null;

            Dictionary<int, List<List<DecodedRow>>> states = new Dictionary<int, List<List<DecodedRow>>>();
            states[rowsStart] = new List<List<DecodedRow>> { new List<DecodedRow>() };

            for (uint idx = 0; idx < rowCount; idx++)
            {
                Dictionary<int, List<List<DecodedRow>>> nextStates = new Dictionary<int, List<List<DecodedRow>>>();
                foreach (KeyValuePair<int, List<List<DecodedRow>>> kv in states)
                {
                    MonopolyCore core;
                    int coreEnd;
                    if (!TryParseMonopolyRowCore(data, kv.Key, blockEnd, out core, out coreEnd))
                        continue;

                    List<Tuple<int, string>> tails = new List<Tuple<int, string>>();
                    tails.Add(new Tuple<int, string>(coreEnd, null));

                    int tailPos = coreEnd;
                    string maybeLottery;
                    if (TryReadUeString(data, ref tailPos, blockEnd, out maybeLottery) && IsValidLotteryId(maybeLottery))
                    {
                        tails.Add(new Tuple<int, string>(tailPos, maybeLottery));
                    }

                    for (int t = 0; t < tails.Count; t++)
                    {
                        int nextPos = tails[t].Item1;
                        string lotteryId = tails[t].Item2;
                        DecodedRow row = BuildMonopolyRow(core, lotteryId, env, packetIndex, viewName);
                        if (row == null) continue;

                        List<List<DecodedRow>> bucket;
                        if (!nextStates.TryGetValue(nextPos, out bucket))
                        {
                            bucket = new List<List<DecodedRow>>();
                            nextStates[nextPos] = bucket;
                        }
                        for (int p = 0; p < kv.Value.Count && bucket.Count < 2; p++)
                        {
                            List<DecodedRow> copy = new List<DecodedRow>(kv.Value[p]);
                            copy.Add(row);
                            bucket.Add(copy);
                        }
                    }
                }
                states = nextStates;
                if (states.Count == 0) return null;
            }

            List<List<DecodedRow>> solutions = null;
            if (!states.TryGetValue(blockEnd, out solutions) && viewName != "raw")
            {
                for (int slack = 1; slack <= MAX_SHIFTED_PADDING_SHORTFALL; slack++)
                {
                    if (states.TryGetValue(blockEnd - slack, out solutions)) break;
                }
            }
            if (solutions == null || solutions.Count != 1) return null;

            ParsedBlock blk = new ParsedBlock
            {
                RecordType = "monopoly",
                Envelope = env,
                Rows = solutions[0]
            };
            blk.Signature = ComputeBlockSignature(blk);
            return blk;
        }

        private static bool TryParseMonopolyRowCore(byte[] data, int pos, int end, out MonopolyCore core, out int nextPos)
        {
            core = null;
            nextPos = pos;
            if (pos + 4 > end) return false;
            uint rawRoll = ReadU32LE(data, pos);
            pos += 4;

            string itemSpec;
            if (!TryReadUeString(data, ref pos, end, out itemSpec)) return false;

            if (pos + 8 > end) return false;
            pos += 4;
            uint secondaryCount = ReadU32LE(data, pos);
            pos += 4;

            string secondaryItem;
            if (!TryReadUeString(data, ref pos, end, out secondaryItem)) return false;

            string resultOrPool;
            if (!TryReadUeString(data, ref pos, end, out resultOrPool)) return false;

            int poolStart = pos;
            string poolId = null;
            string nextStr;
            if (TryReadUeString(data, ref pos, end, out nextStr) && nextStr.StartsWith("CardPool_", StringComparison.Ordinal))
            {
                poolId = nextStr;
            }
            else
            {
                pos = poolStart;
                if (resultOrPool.StartsWith("CardPool_", StringComparison.Ordinal))
                {
                    poolId = resultOrPool;
                }
            }

            if (pos + 8 > end) return false;
            ulong ticks = ReadU64LE(data, pos);
            pos += 8;

            if (DotNetTicksToTimeString(ticks) == null) return false;

            core = new MonopolyCore
            {
                RawRollPoints = rawRoll,
                ItemSpec = itemSpec,
                SecondaryCount = secondaryCount,
                SecondaryItem = secondaryItem,
                PoolId = poolId,
                Ticks = ticks
            };
            nextPos = pos;
            return true;
        }

        private static DecodedRow BuildMonopolyRow(MonopolyCore core, string lotteryId, EnvelopeInfo env, int packetIndex, string viewName)
        {
            string timeStr = DotNetTicksToTimeString(core.Ticks);
            if (timeStr == null) return null;

            string itemId;
            uint count;
            ParseItemSpec(core.ItemSpec, out itemId, out count);

            string rollLabelId = null;
            bool hasRollPoints = false;
            uint rollPoints = 0;

            if (core.RawRollPoints == 0u)
            {
                rollLabelId = "BPUI_LotteryResult_jidianzengli";
            }
            else if (core.RawRollPoints == 0xFFFFFFFFu)
            {
                rollLabelId = "BPUI_LotteryResult_chenmiandi";
            }
            else
            {
                hasRollPoints = true;
                rollPoints = core.RawRollPoints;
            }

            string poolId = core.PoolId;
            if (string.IsNullOrEmpty(poolId))
            {
                if (!string.IsNullOrEmpty(lotteryId) && lotteryId == "Lottery_Permanent")
                    poolId = "CardPool_NewRole";
                else
                    poolId = "CardPool_Character";
            }

            return new DecodedRow
            {
                RecordType = "monopoly",
                Ticks = (long)core.Ticks,
                Time = timeStr,
                PoolId = poolId,
                LotteryId = lotteryId,
                ItemId = itemId,
                Count = count,
                HasRollPoints = hasRollPoints,
                RollPoints = rollPoints,
                RollLabelId = rollLabelId,
                SecondaryItemId = string.IsNullOrEmpty(core.SecondaryItem) ? null : core.SecondaryItem,
                HasSecondaryCount = true,
                SecondaryCount = core.SecondaryCount,
                HasEnvelope = env != null,
                StreamKey = env != null ? env.StreamKey : null,
                PageIndex = env != null ? env.PageIndex : 0u,
                QueryHigh = env != null && env.QueryHigh,
                SegmentIndex = env != null ? env.SegmentIndex : 0u,
                PacketIndex = packetIndex,
                ViewName = viewName
            };
        }

        private static ParsedBlock TryParseForkBlock(byte[] data, int markerPos, string viewName, int packetIndex)
        {
            EnvelopeInfo env = TryParseEnvelope("fork", data, markerPos);
            int rowsStart, blockEnd;
            uint rowCount;
            if (!TryParseFrame(data, markerPos, FORK_MARKER, viewName, out rowsStart, out blockEnd, out rowCount))
                return null;

            int pos = rowsStart;
            List<DecodedRow> rows = new List<DecodedRow>();
            for (uint i = 0; i < rowCount; i++)
            {
                string itemSpec, poolId;
                if (!TryReadUeString(data, ref pos, blockEnd, out itemSpec)) return null;
                if (!TryReadUeString(data, ref pos, blockEnd, out poolId)) return null;
                if (pos + 8 > blockEnd) return null;
                ulong ticks = ReadU64LE(data, pos);
                pos += 8;

                string timeStr = DotNetTicksToTimeString(ticks);
                if (timeStr == null) return null;

                string itemId;
                uint count;
                ParseItemSpec(itemSpec, out itemId, out count);

                rows.Add(new DecodedRow
                {
                    RecordType = "fork",
                    Ticks = (long)ticks,
                    Time = timeStr,
                    PoolId = poolId,
                    LotteryId = null,
                    ItemId = itemId,
                    Count = count,
                    HasRollPoints = false,
                    RollPoints = 0,
                    RollLabelId = null,
                    SecondaryItemId = null,
                    HasSecondaryCount = false,
                    SecondaryCount = 0,
                    HasEnvelope = env != null,
                    StreamKey = env != null ? env.StreamKey : null,
                    PageIndex = env != null ? env.PageIndex : 0u,
                    QueryHigh = env != null && env.QueryHigh,
                    SegmentIndex = env != null ? env.SegmentIndex : 0u,
                    PacketIndex = packetIndex,
                    ViewName = viewName
                });
            }

            int slack = blockEnd - pos;
            int maxSlack = viewName == "raw" ? 0 : MAX_SHIFTED_PADDING_SHORTFALL;
            if (slack < 0 || slack > maxSlack) return null;

            ParsedBlock blk = new ParsedBlock
            {
                RecordType = "fork",
                Envelope = env,
                Rows = rows
            };
            blk.Signature = ComputeBlockSignature(blk);
            return blk;
        }

        private static ParsedBlock TryParseMysteryBoxBlock(byte[] data, int markerPos, string viewName, int packetIndex)
        {
            int pos = markerPos + MYSTERY_MARKER.Length;
            if (pos < data.Length && data[pos] == 0) pos++;
            if (pos + 12 > data.Length) return null;

            uint rowCount = ReadU32LE(data, pos + 8);
            if (rowCount == 0 || rowCount > MAX_ROWS_PER_BLOCK) return null;
            pos += 12;

            List<DecodedRow> rows = new List<DecodedRow>();
            for (uint i = 0; i < rowCount; i++)
            {
                string rewardId;
                if (!TryReadUeString(data, ref pos, data.Length, out rewardId)) return null;
                if (pos + 13 > data.Length) return null;
                uint quantity = ReadU32LE(data, pos);
                pos += 4;
                pos += 1;
                ulong ticks = ReadU64LE(data, pos);
                pos += 8;

                string timeStr = DotNetTicksToTimeString(ticks);
                if (timeStr == null) return null;

                rows.Add(new DecodedRow
                {
                    RecordType = "mystery_box",
                    Ticks = (long)ticks,
                    Time = timeStr,
                    PoolId = "Gashapon_MysteryBox",
                    LotteryId = "Gashapon_MysteryBox",
                    ItemId = rewardId,
                    Count = quantity > 0 ? quantity : 1u,
                    HasRollPoints = false,
                    RollPoints = 0,
                    RollLabelId = null,
                    SecondaryItemId = null,
                    HasSecondaryCount = false,
                    SecondaryCount = 0,
                    HasEnvelope = false,
                    PacketIndex = packetIndex,
                    ViewName = viewName
                });
            }

            ParsedBlock blk = new ParsedBlock
            {
                RecordType = "mystery_box",
                Envelope = null,
                Rows = rows
            };
            blk.Signature = ComputeBlockSignature(blk);
            return blk;
        }

        // -------------------------------------------------------------------
        // Generation & Segment Snapshot Assembler (Deduplicates multi-layer copies)
        // -------------------------------------------------------------------
        private static void AddBlockToAssembler(
            ParsedBlock block,
            List<string> streamOrder,
            Dictionary<string, StreamState> streams,
            List<DecodedRow> legacyRows,
            HashSet<string> legacyBlockSigs)
        {
            if (block.Envelope == null)
            {
                if (legacyBlockSigs.Add(block.Signature))
                {
                    if (!streamOrder.Contains("__legacy__"))
                    {
                        streamOrder.Add("__legacy__");
                    }
                    legacyRows.AddRange(block.Rows);
                }
                return;
            }

            string key = block.Envelope.StreamKey;
            StreamState state;
            if (!streams.TryGetValue(key, out state))
            {
                state = new StreamState();
                streams[key] = state;
                streamOrder.Add(key);
            }
            if (state.Generations.Count == 0)
            {
                state.Generations.Add(new GenerationData { Index = 0 });
            }

            GenerationData gen = state.Generations[state.Generations.Count - 1];
            SegmentData existing;
            if (gen.Segments.TryGetValue(block.Envelope.SegmentIndex, out existing))
            {
                if (existing.Signature == block.Signature)
                {
                    return;
                }
                gen = new GenerationData { Index = state.Generations.Count };
                state.Generations.Add(gen);
            }

            gen.Segments[block.Envelope.SegmentIndex] = new SegmentData
            {
                Index = block.Envelope.SegmentIndex,
                Rows = block.Rows,
                Signature = block.Signature
            };
        }

        private static List<DecodedRow> AssembleAll(
            List<string> streamOrder,
            Dictionary<string, StreamState> streams,
            List<DecodedRow> legacyRows,
            List<string> warnings)
        {
            List<DecodedRow> all = new List<DecodedRow>();
            for (int i = 0; i < streamOrder.Count; i++)
            {
                string key = streamOrder[i];
                if (key == "__legacy__")
                {
                    all.AddRange(legacyRows);
                    continue;
                }
                all.AddRange(AssembleStream(key, streams[key], warnings));
            }
            return all;
        }

        private static List<DecodedRow> AssembleStream(string key, StreamState state, List<string> warnings)
        {
            List<DecodedRow> resultRows = new List<DecodedRow>();
            bool hasMax = false;
            uint resultMaxSeg = 0;

            for (int g = 0; g < state.Generations.Count; g++)
            {
                GenerationData gen = state.Generations[g];
                if (gen.Segments.Count == 0) continue;

                uint genMin = uint.MaxValue;
                uint genMax = 0;
                List<DecodedRow> genRows = new List<DecodedRow>();
                foreach (KeyValuePair<uint, SegmentData> kv in gen.Segments)
                {
                    if (kv.Key < genMin) genMin = kv.Key;
                    if (kv.Key > genMax) genMax = kv.Key;
                    genRows.AddRange(kv.Value.Rows);
                }

                if (resultRows.Count == 0)
                {
                    resultRows = genRows;
                    resultMaxSeg = genMax;
                    hasMax = true;
                    continue;
                }

                if (genMin == 0 || genMin == 1)
                {
                    if (!hasMax || genMax >= resultMaxSeg)
                    {
                        resultRows = genRows;
                        resultMaxSeg = genMax;
                        hasMax = true;
                        continue;
                    }
                    List<DecodedRow> merged = PartialSnapshotMerge(genRows, resultRows);
                    if (merged != null)
                    {
                        resultRows = merged;
                    }
                    else
                    {
                        warnings.Add(key + ": partial snapshot could not be merged cleanly; kept prior snapshot.");
                    }
                    continue;
                }

                if (hasMax && genMin > resultMaxSeg)
                {
                    resultRows.AddRange(genRows);
                    resultMaxSeg = genMax;
                    continue;
                }

                warnings.Add(key + ": overlapping non-zero snapshot generation ignored.");
            }
            return resultRows;
        }

        private static List<DecodedRow> PartialSnapshotMerge(List<DecodedRow> newRows, List<DecodedRow> oldRows)
        {
            if (newRows.Count == 0) return new List<DecodedRow>(oldRows);
            if (oldRows.Count == 0) return new List<DecodedRow>(newRows);

            List<string> newSigs = new List<string>(newRows.Count);
            List<string> oldSigs = new List<string>(oldRows.Count);
            for (int i = 0; i < newRows.Count; i++) newSigs.Add(ComputeRowSignature(newRows[i]));
            for (int i = 0; i < oldRows.Count; i++) oldSigs.Add(ComputeRowSignature(oldRows[i]));

            int maxOverlap = Math.Min(newSigs.Count, oldSigs.Count);
            for (int overlap = maxOverlap; overlap >= 1; overlap--)
            {
                List<int> positions = new List<int>();
                for (int pos = 0; pos <= oldSigs.Count - overlap; pos++)
                {
                    bool match = true;
                    for (int k = 0; k < overlap; k++)
                    {
                        if (oldSigs[pos + k] != newSigs[newSigs.Count - overlap + k])
                        {
                            match = false;
                            break;
                        }
                    }
                    if (match) positions.Add(pos);
                }
                if (positions.Count == 1)
                {
                    List<DecodedRow> merged = new List<DecodedRow>(newRows);
                    for (int idx = positions[0] + overlap; idx < oldRows.Count; idx++)
                    {
                        merged.Add(oldRows[idx]);
                    }
                    return merged;
                }
                if (positions.Count > 1) return null;
            }
            return null;
        }

        // -------------------------------------------------------------------
        // Deterministic SHA-256 Record IDs (semantic_v1)
        // -------------------------------------------------------------------
        private static void AssignStableRecordIds(List<DecodedRow> records)
        {
            Dictionary<string, int> seen = new Dictionary<string, int>();
            for (int i = 0; i < records.Count; i++)
            {
                DecodedRow r = records[i];
                string baseMaterial = string.Join("|", new string[] {
                    "semantic_v1",
                    r.RecordType ?? "",
                    r.Time ?? "",
                    r.PoolId ?? "",
                    r.ItemId ?? "",
                    r.Count.ToString(CultureInfo.InvariantCulture),
                    r.HasRollPoints ? r.RollPoints.ToString(CultureInfo.InvariantCulture) : "",
                    r.RollLabelId ?? "",
                    r.SecondaryItemId ?? "",
                    r.HasSecondaryCount ? r.SecondaryCount.ToString(CultureInfo.InvariantCulture) : ""
                });
                string baseKey = Sha256Hex32(baseMaterial);
                int occ;
                if (!seen.TryGetValue(baseKey, out occ)) occ = 0;
                seen[baseKey] = occ + 1;

                r.RecordId = (occ == 0)
                    ? baseKey
                    : Sha256Hex32(baseKey + "|duplicate_occurrence|" + occ.ToString(CultureInfo.InvariantCulture));
            }
        }

        private static string ComputeRowSignature(DecodedRow r)
        {
            return string.Join("|", new string[] {
                r.RecordType ?? "",
                r.Ticks.ToString(CultureInfo.InvariantCulture),
                r.PoolId ?? "",
                r.LotteryId ?? "",
                r.ItemId ?? "",
                r.Count.ToString(CultureInfo.InvariantCulture),
                r.HasRollPoints ? r.RollPoints.ToString(CultureInfo.InvariantCulture) : "",
                r.RollLabelId ?? "",
                r.SecondaryItemId ?? "",
                r.HasSecondaryCount ? r.SecondaryCount.ToString(CultureInfo.InvariantCulture) : ""
            });
        }

        private static string ComputeBlockSignature(ParsedBlock blk)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append(blk.RecordType);
            for (int i = 0; i < blk.Rows.Count; i++)
            {
                sb.Append('\n').Append(ComputeRowSignature(blk.Rows[i]));
            }
            return Sha256Hex32(sb.ToString());
        }

        private static string Sha256Hex32(string text)
        {
            using (SHA256 sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(text));
                StringBuilder sb = new StringBuilder(32);
                for (int i = 0; i < 16; i++)
                {
                    sb.Append(hash[i].ToString("x2"));
                }
                return sb.ToString();
            }
        }

        // -------------------------------------------------------------------
        // Binary Parsing Helpers
        // -------------------------------------------------------------------
        private static bool TryReadUeString(byte[] data, ref int pos, int end, out string value)
        {
            value = null;
            if (pos + 4 > end) return false;
            uint len = ReadU32LE(data, pos);
            if (len == 0 || len > MAX_STRING_LEN) return false;
            if (pos + 4 + (int)len > end) return false;

            int strStart = pos + 4;
            int strLen = (int)len;
            if (data[strStart + strLen - 1] == 0) strLen--;
            value = Encoding.UTF8.GetString(data, strStart, strLen);
            pos = pos + 4 + (int)len;
            return true;
        }

        private static bool IsValidLotteryId(string value)
        {
            if (string.IsNullOrEmpty(value) || !value.StartsWith("Lottery_", StringComparison.Ordinal))
                return false;
            if (value.Length <= 8 || value.Length > 64) return false;
            for (int i = 0; i < value.Length; i++)
            {
                char c = value[i];
                bool ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-';
                if (!ok) return false;
            }
            return true;
        }

        private static void ParseItemSpec(string spec, out string itemId, out uint count)
        {
            itemId = spec ?? "";
            count = 1;
            if (string.IsNullOrEmpty(spec)) return;
            int comma = spec.LastIndexOf(',');
            if (comma <= 0 || comma >= spec.Length - 1) return;
            uint parsed;
            if (uint.TryParse(spec.Substring(comma + 1), NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed) && parsed > 0)
            {
                itemId = spec.Substring(0, comma);
                count = parsed;
            }
        }

        private static string DotNetTicksToTimeString(ulong rawTicks)
        {
            if (rawTicks > (ulong)long.MaxValue) return null;
            long ticks = (long)rawTicks;
            long unixSeconds = (ticks - DOTNET_EPOCH_TICKS) / TICKS_PER_SECOND;
            if (unixSeconds < MIN_UNIX_SECONDS || unixSeconds > MAX_UNIX_SECONDS) return null;
            try
            {
                DateTime dt = new DateTime(ticks, DateTimeKind.Utc);
                return dt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
            }
            catch
            {
                return null;
            }
        }

        private static int IndexOfBytes(byte[] haystack, byte[] needle, int startIndex)
        {
            int limit = haystack.Length - needle.Length;
            for (int i = startIndex; i <= limit; i++)
            {
                if (haystack[i] != needle[0]) continue;
                bool match = true;
                for (int j = 1; j < needle.Length; j++)
                {
                    if (haystack[i + j] != needle[j])
                    {
                        match = false;
                        break;
                    }
                }
                if (match) return i;
            }
            return -1;
        }

        private static ushort ReadU16LE(byte[] b, int o)
        {
            return (ushort)(b[o] | (b[o + 1] << 8));
        }

        private static ushort ReadU16BE(byte[] b, int o)
        {
            return (ushort)((b[o] << 8) | b[o + 1]);
        }

        private static uint ReadU32LE(byte[] b, int o)
        {
            return (uint)(b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24));
        }

        private static uint ReadU32BE(byte[] b, int o)
        {
            return (uint)((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
        }

        private static ulong ReadU64LE(byte[] b, int o)
        {
            ulong lo = ReadU32LE(b, o);
            ulong hi = ReadU32LE(b, o + 4);
            return lo | (hi << 32);
        }
    }
}
'@

if (-not ("NteZeroInstallV2.NtePktmonDecoderV2" -as [type])) {
    Add-Type -TypeDefinition $decoderSource -Language CSharp
}

# ---------------------------------------------------------------------------
# 3. Capture (pktmon) OR Offline Replay
# ---------------------------------------------------------------------------
$sessionId = [Guid]::NewGuid().ToString("N").Substring(0, 8)
$etlPath = Join-Path $env:TEMP ("nte-capture-" + $sessionId + ".etl")
$pcapPath = Join-Path $env:TEMP ("nte-capture-" + $sessionId + ".pcapng")
$cleanupFiles = @()

function Invoke-PktmonCleanup {
    try { & pktmon stop 2>$null | Out-Null } catch {}
    try { & pktmon filter remove 2>$null | Out-Null } catch {}
    try { & pktmon unload 2>$null | Out-Null } catch {}
}

function Get-NteCandidateTcpPorts([int[]]$pids) {
    $ports = New-Object System.Collections.Generic.HashSet[int]
    foreach ($known in @(30031, 10012, 30230)) {
        [void]$ports.Add($known)
    }
    foreach ($p in $pids) {
        try {
            $conns = Get-NetTCPConnection -OwningProcess $p -ErrorAction SilentlyContinue
            foreach ($c in $conns) {
                if ($c.RemotePort -gt 0 -and $c.RemotePort -ne 443 -and $c.RemoteAddress -ne "127.0.0.1" -and $c.RemoteAddress -ne "::1" -and $c.RemoteAddress -ne "0.0.0.0") {
                    [void]$ports.Add([int]$c.RemotePort)
                }
            }
        } catch {}
    }
    return @($ports | Sort-Object | Select-Object -First 12)
}

$targetPcap = ""

try {
    if (-not [string]::IsNullOrWhiteSpace($ReplayPcap)) {
        if (-not (Test-Path -LiteralPath $ReplayPcap)) {
            throw "Replay file not found: $ReplayPcap"
        }
        $ext = [IO.Path]::GetExtension($ReplayPcap).ToLowerInvariant()
        if ($ext -eq ".etl") {
            if (-not $JsonOnly) { Write-Host "  Converting ETL to pcapng via pktmon..." -ForegroundColor Cyan }
            & pktmon etl2pcap "$ReplayPcap" --out "$pcapPath" 2>&1 | Out-Null
            $targetPcap = $pcapPath
            if (-not $KeepCapture) { $cleanupFiles += $pcapPath }
        } else {
            $targetPcap = (Resolve-Path -LiteralPath $ReplayPcap).Path
        }
    } else {
        if (-not (Get-Command pktmon.exe -ErrorAction SilentlyContinue)) {
            throw "Windows built-in pktmon.exe was not found. Requires Windows 10 (2004+) or Windows 11."
        }

        Write-Host ""
        Write-Host "  =========================================================" -ForegroundColor Cyan
        Write-Host "    NTE Zero-Install Pull History Importer (Windows pktmon)" -ForegroundColor Cyan
        Write-Host "  =========================================================" -ForegroundColor Cyan
        Write-Host ""

        $gameProcs = @(Get-Process -Name "HTGame*" -ErrorAction SilentlyContinue)
        $gamePids = @()
        if ($gameProcs.Count -gt 0) {
            $gamePids = @($gameProcs | ForEach-Object { $_.Id })
            Write-Host "  [OK] Detected NTE process: $($gameProcs[0].ProcessName) (PID $($gamePids -join ', '))" -ForegroundColor Green
        } else {
            Write-Host "  [!] HTGame.exe not detected yet -- make sure Neverness to Everness is running." -ForegroundColor Yellow
        }

        Invoke-PktmonCleanup

        if (-not $NoFilter) {
            $tcpPorts = Get-NteCandidateTcpPorts $gamePids
            & pktmon filter add NTE_UDP -t UDP 2>&1 | Out-Null
            foreach ($tp in $tcpPorts) {
                & pktmon filter add ("NTE_TCP_" + $tp) -t TCP -p $tp 2>&1 | Out-Null
            }
            Write-Host ("  [OK] Active filters: UDP (all) + TCP ports " + ($tcpPorts -join ", ")) -ForegroundColor DarkCyan
        } else {
            Write-Host "  [OK] Capture mode: unfiltered (--comp all)" -ForegroundColor DarkCyan
        }

        # Use --comp all so Native 802.11 Wi-Fi adapters also emit clean unencrypted Ethernet/IP frames at NDIS/TCPIP
        $startOut = & pktmon start --capture --pkt-size 0 --comp all --file-name "$etlPath" 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "pktmon start failed: $($startOut -join ' ')"
        }
        if (-not $KeepCapture) {
            $cleanupFiles += $etlPath
            $cleanupFiles += $pcapPath
        }

        Write-Host ""
        Write-Host "  Capture is LIVE (read-only via Microsoft pktmon.exe)." -ForegroundColor Green
        Write-Host ""
        if ($AutoPage) {
            $autoPageSource = @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

namespace NteZeroInstallAutoPageV1
{
    public static class AutoPager
    {
        private const int VK_ESCAPE = 0x1B;
        private const int VK_F8 = 0x77;
        private const int VK_F9 = 0x78;
        private const uint INPUT_MOUSE = 0;
        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MOUSEINPUT
        {
            public int dx;
            public int dy;
            public uint mouseData;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct HARDWAREINPUT
        {
            public uint uMsg;
            public ushort wParamL;
            public ushort wParamH;
        }

        [StructLayout(LayoutKind.Explicit)]
        private struct INPUTUNION
        {
            [FieldOffset(0)] public MOUSEINPUT mi;
            [FieldOffset(0)] public KEYBDINPUT ki;
            [FieldOffset(0)] public HARDWAREINPUT hi;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct INPUT
        {
            public uint type;
            public INPUTUNION u;
        }

        [DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int vKey);

        [DllImport("user32.dll")]
        private static extern bool GetCursorPos(out POINT lpPoint);

        [DllImport("user32.dll")]
        private static extern bool SetCursorPos(int x, int y);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        private static bool IsKeyDown(int vk)
        {
            return (GetAsyncKeyState(vk) & 0x8000) != 0;
        }

        private static void LeftClickAt(int x, int y, Random rng)
        {
            int jx = x + rng.Next(-1, 2);
            int jy = y + rng.Next(-1, 2);
            SetCursorPos(jx, jy);

            INPUT[] down = new INPUT[1];
            down[0].type = INPUT_MOUSE;
            down[0].u.mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
            SendInput(1, down, Marshal.SizeOf(typeof(INPUT)));

            Thread.Sleep(rng.Next(24, 46));

            INPUT[] up = new INPUT[1];
            up[0].type = INPUT_MOUSE;
            up[0].u.mi.dwFlags = MOUSEEVENTF_LEFTUP;
            SendInput(1, up, Marshal.SizeOf(typeof(INPUT)));
        }

        public static int InputStructSize()
        {
            return Marshal.SizeOf(typeof(INPUT));
        }

        public static int RunInteractive(int maxPagesPerBurst, int baseDelayMs)
        {
            if (maxPagesPerBurst < 1) maxPagesPerBurst = 200;
            if (baseDelayMs < 120) baseDelayMs = 120;

            Random rng = new Random();
            bool clicking = false;
            bool f8WasDown = false;
            int totalClicks = 0;
            int burstClicks = 0;
            int anchorX = 0;
            int anchorY = 0;
            IntPtr anchorHwnd = IntPtr.Zero;
            DateTime nextClickAt = DateTime.UtcNow;

            // Flush any stale key states
            GetAsyncKeyState(VK_F8);
            GetAsyncKeyState(VK_F9);
            GetAsyncKeyState(VK_ESCAPE);

            while (true)
            {
                if (IsKeyDown(VK_F9))
                {
                    Console.WriteLine();
                    Console.WriteLine("  [AutoPage] F9 pressed -- finishing capture.");
                    break;
                }

                if (clicking && IsKeyDown(VK_ESCAPE))
                {
                    clicking = false;
                    Console.WriteLine();
                    Console.WriteLine("  [AutoPage] Paused (Esc). Hover Next (>) and press F8 to resume, or F9 to decode.");
                    Thread.Sleep(250);
                }

                bool f8Down = IsKeyDown(VK_F8);
                if (f8Down && !f8WasDown)
                {
                    if (!clicking)
                    {
                        POINT pt;
                        GetCursorPos(out pt);
                        anchorX = pt.X;
                        anchorY = pt.Y;
                        anchorHwnd = GetForegroundWindow();
                        burstClicks = 0;
                        clicking = true;
                        nextClickAt = DateTime.UtcNow;
                        Console.WriteLine();
                        Console.WriteLine("  [AutoPage] STARTED at (" + anchorX + ", " + anchorY + "). Move mouse, press F8 to pause, or F9 to finish.");
                    }
                    else
                    {
                        clicking = false;
                        Console.WriteLine();
                        Console.WriteLine("  [AutoPage] PAUSED after " + burstClicks + " clicks. Press F8 to resume or F9 to decode.");
                    }
                }
                f8WasDown = f8Down;

                if (clicking && DateTime.UtcNow >= nextClickAt)
                {
                    POINT nowPt;
                    GetCursorPos(out nowPt);
                    int dx = Math.Abs(nowPt.X - anchorX);
                    int dy = Math.Abs(nowPt.Y - anchorY);
                    IntPtr nowHwnd = GetForegroundWindow();

                    if (dx > 25 || dy > 25)
                    {
                        clicking = false;
                        Console.WriteLine();
                        Console.WriteLine("  [AutoPage] Auto-paused (mouse moved). Switch boards, hover Next (>), press F8 to resume or F9 to decode.");
                    }
                    else if (nowHwnd != anchorHwnd)
                    {
                        clicking = false;
                        Console.WriteLine();
                        Console.WriteLine("  [AutoPage] Auto-paused (window focus changed). Return to NTE, hover Next (>), press F8 or F9 to decode.");
                    }
                    else if (burstClicks >= maxPagesPerBurst)
                    {
                        clicking = false;
                        Console.WriteLine();
                        Console.WriteLine("  [AutoPage] Reached MaxPages (" + maxPagesPerBurst + ") -- paused. Press F8 for more or F9 to decode.");
                    }
                    else
                    {
                        LeftClickAt(anchorX, anchorY, rng);
                        burstClicks++;
                        totalClicks++;
                        Console.Write("\r  [AutoPage] Clicks this board: " + burstClicks + " / " + maxPagesPerBurst + " (total: " + totalClicks + ")   ");
                        int jitter = rng.Next(-60, 90);
                        int wait = Math.Max(140, baseDelayMs + jitter);
                        nextClickAt = DateTime.UtcNow.AddMilliseconds(wait);
                    }
                }

                Thread.Sleep(20);
            }

            return totalClicks;
        }
    }
}
'@
            if (-not ("NteZeroInstallAutoPageV1.AutoPager" -as [type])) {
                Add-Type -TypeDefinition $autoPageSource -Language CSharp
            }

            Write-Host "  [AutoPage Mode Enabled] (MaxPages=$MaxPages, Delay=~${ClickDelayMs}ms)" -ForegroundColor Yellow
            Write-Host "    1. Switch to Neverness to Everness and open History / Dice Roll Records (page 1)." -ForegroundColor Gray
            Write-Host "    2. Hover your mouse cursor over the Next Page (>) button." -ForegroundColor Gray
            Write-Host "    3. Press [F8] to START auto-clicking. Move mouse or press [F8]/[Esc] to PAUSE." -ForegroundColor White
            Write-Host "       (You can pause, switch to Standard/Arc/Mystery Box, hover Next, and press [F8] again!)" -ForegroundColor DarkGray
            Write-Host "    4. Press [F9] anytime to STOP capture and decode all captured pages." -ForegroundColor Cyan
            Write-Host ""
            $null = [NteZeroInstallAutoPageV1.AutoPager]::RunInteractive($MaxPages, $ClickDelayMs)
        } else {
            Write-Host "  Next steps:" -ForegroundColor White
            Write-Host "    1. Switch to Neverness to Everness and press [F3] (Scarborough Fair)." -ForegroundColor Gray
            Write-Host "    2. Open History / Dice Roll Records for Limited Board, Standard Board," -ForegroundColor Gray
            Write-Host "       Arc Research, and/or Mystery Box, and flip through your pages." -ForegroundColor Gray
            Write-Host "       (If already open, close and reopen History so NTE re-fetches page 1.)" -ForegroundColor DarkGray
            Write-Host "    3. Come back here and press [ENTER] to stop and decode." -ForegroundColor Gray
            Write-Host ""
            Read-Host "  Press [ENTER] when done flipping through your pull history" | Out-Null
        }

        Write-Host "  Stopping pktmon and converting capture..." -ForegroundColor Cyan
        & pktmon stop 2>&1 | Out-Null
        & pktmon filter remove 2>&1 | Out-Null

        if (-not (Test-Path -LiteralPath $etlPath)) {
            throw "Capture file was not created by pktmon."
        }

        & pktmon etl2pcap "$etlPath" --out "$pcapPath" 2>&1 | Out-Null
        if (-not (Test-Path -LiteralPath $pcapPath)) {
            throw "pktmon etl2pcap failed to generate pcapng."
        }
        $targetPcap = $pcapPath
    }

    # -----------------------------------------------------------------------
    # 4. Decode & Emit Sanitized nte-gacha-export v2.1 JSON
    # -----------------------------------------------------------------------
    $summary = [NteZeroInstallV2.NtePktmonDecoderV2]::DecodePcapFile($targetPcap)

    $exportedList = New-Object System.Collections.ArrayList
    foreach ($rec in $summary.Records) {
        $obj = [ordered]@{
            record_id    = $rec.RecordId
            source_order = $rec.SourceOrder
            record_type  = $rec.RecordType
            time         = $rec.Time
            pool_id      = $rec.PoolId
            item_id      = $rec.ItemId
            count        = [int]$rec.Count
        }
        if (-not [string]::IsNullOrEmpty($rec.LotteryId)) {
            $obj["lottery_id"] = $rec.LotteryId
            $obj["banner_id"] = $rec.LotteryId
        }
        if ($rec.HasRollPoints) {
            $obj["roll_points"] = [int]$rec.RollPoints
            $obj["roll_label"] = $rec.RollPoints.ToString()
        } elseif (-not [string]::IsNullOrEmpty($rec.RollLabelId)) {
            $obj["roll_label_id"] = $rec.RollLabelId
            if ($rec.RollLabelId -eq "BPUI_LotteryResult_jidianzengli") {
                $obj["roll_label"] = "Points Gift"
            } elseif ($rec.RollLabelId -eq "BPUI_LotteryResult_chenmiandi") {
                $obj["roll_label"] = "Slumberland"
            }
        }
        if (-not [string]::IsNullOrEmpty($rec.SecondaryItemId)) {
            $obj["secondary_item_id"] = $rec.SecondaryItemId
            if ($rec.HasSecondaryCount) {
                $obj["secondary_count"] = [int]$rec.SecondaryCount
            }
        }
        [void]$exportedList.Add($obj)
    }

    $payloadObj = [ordered]@{
        info = [ordered]@{
            schema         = "nte-gacha-export"
            schema_version = "2.1"
            source         = "pktmon_zero_install"
            exported_at    = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
            locale         = "en"
            stats          = [ordered]@{
                packets_scanned      = $summary.PacketsScanned
                udp_payloads_scanned = $summary.UdpPayloadsScanned
                tcp_payloads_scanned = $summary.TcpPayloadsScanned
                blocks_decoded       = $summary.BlocksDecoded
                records_exported     = $exportedList.Count
            }
        }
        nte = [ordered]@{
            list = @($exportedList)
        }
    }

    $json = $payloadObj | ConvertTo-Json -Depth 6

    if ($JsonOnly) {
        Write-Output $json
    } else {
        Write-Host ""
        $ltStr = if ($summary.LinkTypesSeen.Count -gt 0) { $summary.LinkTypesSeen -join "," } else { "none" }
        Write-Host ("  Scanned {0} packets ({1} UDP, {2} TCP; link types: {3}) -> decoded {4} pull records." -f $summary.PacketsScanned, $summary.UdpPayloadsScanned, $summary.TcpPayloadsScanned, $ltStr, $exportedList.Count) -ForegroundColor White

        if ($summary.Warnings.Count -gt 0) {
            foreach ($w in $summary.Warnings) {
                Write-Host "  [Warn] $w" -ForegroundColor Yellow
            }
        }

        if ($exportedList.Count -eq 0) {
            Write-Host ""
            Write-Host "  [!] No pull history packets were captured." -ForegroundColor Yellow
            Write-Host "      - Close and reopen the in-game History / Dice Roll Records screen AFTER starting capture." -ForegroundColor Gray
            Write-Host "      - If using a VPN or PPPoE, disconnect VPN or re-run with -NoFilter." -ForegroundColor Gray
            Write-Host "      - Tip: Run with -KeepCapture to keep the temp .pcapng for diagnostics." -ForegroundColor DarkGray
        } else {
            $byPool = @{}
            foreach ($item in $exportedList) {
                $k = $item["pool_id"]
                if (-not $byPool.ContainsKey($k)) { $byPool[$k] = 0 }
                $byPool[$k]++
            }
            Write-Host ""
            Write-Host "  Pool breakdown:" -ForegroundColor Cyan
            foreach ($k in ($byPool.Keys | Sort-Object)) {
                Write-Host ("    - {0}: {1} records" -f $k, $byPool[$k]) -ForegroundColor Gray
            }

            if (-not $NoClipboard) {
                try {
                    Set-Clipboard -Value $json
                    Write-Host ""
                    Write-Host "  [OK] Copied sanitized JSON to clipboard! Paste it (Ctrl+V) on the NTE Tracker Import page." -ForegroundColor Green
                } catch {
                    Write-Host "  [!] Could not copy to clipboard: $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }

            if (-not $NoFile) {
                $savePath = $OutFile
                if ([string]::IsNullOrWhiteSpace($savePath)) {
                    $downloads = Join-Path $env:USERPROFILE "Downloads"
                    if (-not (Test-Path $downloads)) { $downloads = $env:TEMP }
                    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
                    $savePath = Join-Path $downloads ("nte-pulls-" + $stamp + ".json")
                }
                [IO.File]::WriteAllText($savePath, $json, (New-Object Text.UTF8Encoding($false)))
                Write-Host "  [OK] Also saved backup JSON to: $savePath" -ForegroundColor Green
            }
        }
        Write-Host ""
    }
}
finally {
    if ([string]::IsNullOrWhiteSpace($ReplayPcap)) {
        Invoke-PktmonCleanup
    }
    if (-not $KeepCapture) {
        foreach ($f in $cleanupFiles) {
            if (Test-Path -LiteralPath $f) {
                Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue
            }
        }
    }
}
