<?php
/**
 * og.php — Dynamic OG meta tag handler for Intal website
 * Usage: og.php?page=artikujt&gjinia=Meshkuj&kat=Mbathje
 *        og.php?page=artikujt&art=ARTICLE_ID
 *        og.php?page=pelhura&kat=KATNAME
 *        og.php?page=pelhura&art=PELHURE_ID
 */

$SB_URL = 'https://qucwmmizqxudxvolfwkx.supabase.co';
$SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1Y3dtbWl6cXh1ZHh2b2xmd2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjIxODIsImV4cCI6MjA4OTYzODE4Mn0.xp5e-4X2IzgizknjYKmai8qOOrwM-_BO80v_QTI4viw';
$SITE   = 'https://intalal.com';

$page   = isset($_GET['page'])   ? trim($_GET['page'])   : '';
$gjinia = isset($_GET['gjinia']) ? trim($_GET['gjinia']) : '';
$kat    = isset($_GET['kat'])    ? trim($_GET['kat'])    : '';
$art    = isset($_GET['art'])    ? trim($_GET['art'])    : '';

$title    = 'Intal Underwear — Koleksioni i të Brendëshmes';
$desc     = 'Cilësi shqiptare direkt nga fabrika. Meshkuj, Femra, Fëmijë.';
$img      = $SITE . '/og_image.png';
$redirect = $SITE . '/';

/* ── helpers ── */
function sb_fetch($SB_URL, $SB_KEY, $key) {
    $url = $SB_URL . '/rest/v1/konfigurimi?key=eq.' . urlencode($key);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
            CURLOPT_HTTPHEADER     => [
                'apikey: ' . $SB_KEY,
                'Authorization: Bearer ' . $SB_KEY,
            ],
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
    } else {
        $ctx = stream_context_create(['http' => [
            'header'  => "apikey: $SB_KEY\r\nAuthorization: Bearer $SB_KEY\r\n",
            'timeout' => 5,
        ]]);
        $res = @file_get_contents($url, false, $ctx);
    }
    if (!$res) return null;
    $rows = json_decode($res, true);
    if (!$rows || empty($rows[0]['value'])) return null;
    return json_decode($rows[0]['value'], true);
}

function make_img($raw, $SITE) {
    if (!$raw) return null;
    $photos = is_array($raw) ? $raw : [];
    $p = $photos[0] ?? null;
    if (!$p) return null;
    return (strpos($p, 'http') === 0) ? $p : $SITE . '/' . ltrim($p, '/');
}

function slug($str) {
    return strtolower(str_replace([' ', '_'], '-', $str));
}

/* ── artikujt page ── */
if ($page === 'artikujt') {
    $title    = 'Artikujt — Intal Underwear';
    $desc     = 'Koleksioni i plotë i të brendëshmes — Meshkuj, Femra, Fëmijë. Cilësi shqiptare direkt nga fabrika.';
    $redirect = $SITE . '/artikujt';

    if ($art) {
        /* Individual article */
        $articles = sb_fetch($SB_URL, $SB_KEY, 'artikujt');
        if ($articles) {
            foreach ($articles as $a) {
                if (($a['id'] ?? '') === $art) {
                    $title = ($a['name'] ?? 'Artikull') . ' — Intal Underwear';
                    $desc  = $a['desc'] ?? 'Koleksioni i plotë i të brendëshmes — Intal Albania.';
                    $found = make_img($a['photos'] ?? [], $SITE);
                    if ($found) $img = $found;
                    $redirect = $SITE . '/artikujt#~' . rawurlencode($art);
                    break;
                }
            }
        }
    } elseif ($gjinia) {
        /* Gjinia/sub filter (Meshkuj, Femra…) */
        $label    = $gjinia;
        $title    = $label . ' — Intal Underwear';
        $desc     = 'Koleksioni i plotë i të brendëshmes — ' . $label . '. Cilësi shqiptare direkt nga fabrika.';
        $hash     = slug($gjinia);
        $redirect = $SITE . '/artikujt#' . rawurlencode($hash);

        if ($kat) {
            $label    = $kat . ' · ' . $gjinia;
            $title    = $label . ' — Intal Underwear';
            $desc     = $gjinia . ' / ' . $kat . ' — Koleksioni i plotë i të brendëshmes. Cilësi shqiptare direkt nga fabrika.';
            $redirect = $SITE . '/artikujt#' . rawurlencode($hash) . '/' . rawurlencode(slug($kat));
        }

        /* First photo from matching articles */
        $articles = sb_fetch($SB_URL, $SB_KEY, 'artikujt');
        if ($articles) {
            foreach ($articles as $a) {
                $subs = $a['sub'] ?? [];
                if (!is_array($subs)) $subs = $subs ? [$subs] : [];
                $match = false;
                foreach ($subs as $s) {
                    if (strtolower($s) === strtolower($gjinia)) { $match = true; break; }
                }
                if (!$match) continue;
                /* If kat filter also set, match kat too */
                if ($kat) {
                    $kats = $a['kat'] ?? [];
                    if (!is_array($kats)) $kats = $kats ? [$kats] : [];
                    $katMatch = false;
                    foreach ($kats as $k) {
                        if (strtolower($k) === strtolower($kat)) { $katMatch = true; break; }
                    }
                    if (!$katMatch) continue;
                }
                $found = make_img($a['photos'] ?? [], $SITE);
                if ($found) { $img = $found; break; }
            }
        }
    }

/* ── pelhura page ── */
} elseif ($page === 'pelhura') {
    $title    = 'Pelhura — Intal Underwear';
    $desc     = 'Pëlhurat tona premium — material cilësor për prodhim të brendëshmes. Intal Albania.';
    $redirect = $SITE . '/pelhura';

    if ($art) {
        $pelhurat = sb_fetch($SB_URL, $SB_KEY, 'pelhurat');
        if ($pelhurat) {
            foreach ($pelhurat as $a) {
                if (($a['id'] ?? '') === $art) {
                    $title = ($a['name'] ?? 'Pelhurë') . ' — Intal Underwear';
                    $desc  = $a['desc'] ?? 'Pëlhurat tona premium — material cilësor. Intal Albania.';
                    $found = make_img($a['photos'] ?? [], $SITE);
                    if ($found) $img = $found;
                    $redirect = $SITE . '/pelhura#~' . rawurlencode($art);
                    break;
                }
            }
        }
    } elseif ($kat) {
        $title    = $kat . ' — Pelhura Intal';
        $desc     = 'Pelhura ' . $kat . ' — material premium për prodhim të brendëshmes. Intal Albania.';
        $redirect = $SITE . '/pelhura#' . rawurlencode(slug($kat));

        $pelhurat = sb_fetch($SB_URL, $SB_KEY, 'pelhurat');
        if ($pelhurat) {
            foreach ($pelhurat as $a) {
                $kats = $a['kat'] ?? [];
                if (!is_array($kats)) $kats = $kats ? [$kats] : [];
                foreach ($kats as $k) {
                    if (strtolower($k) === strtolower($kat)) {
                        $found = make_img($a['photos'] ?? [], $SITE);
                        if ($found) { $img = $found; break 2; }
                    }
                }
            }
        }
    }
}

/* ── canonical og:url (the og.php URL itself so scrapers cache correctly) ── */
$ogUrl = $SITE . '/og.php?' . http_build_query(array_filter([
    'page'   => $page,
    'gjinia' => $gjinia,
    'kat'    => $kat,
    'art'    => $art,
]));

$title   = htmlspecialchars($title,   ENT_QUOTES, 'UTF-8');
$desc    = htmlspecialchars($desc,    ENT_QUOTES, 'UTF-8');
$img     = htmlspecialchars($img,     ENT_QUOTES, 'UTF-8');
$ogUrl   = htmlspecialchars($ogUrl,   ENT_QUOTES, 'UTF-8');
$jsRedir = json_encode($redirect);
?>
<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<title><?= $title ?></title>
<meta name="description" content="<?= $desc ?>">
<meta property="og:type"        content="website">
<meta property="og:title"       content="<?= $title ?>">
<meta property="og:description" content="<?= $desc ?>">
<meta property="og:image"       content="<?= $img ?>">
<meta property="og:url"         content="<?= $ogUrl ?>">
<meta property="og:site_name"   content="Intal Underwear">
<meta name="twitter:card"       content="summary_large_image">
<meta name="twitter:title"      content="<?= $title ?>">
<meta name="twitter:description"content="<?= $desc ?>">
<meta name="twitter:image"      content="<?= $img ?>">
<link rel="icon" type="image/png" href="<?= $SITE ?>/favicon.png">
<meta http-equiv="refresh" content="0;url=<?= htmlspecialchars($redirect, ENT_QUOTES, 'UTF-8') ?>">
</head>
<body>
<script>window.location.replace(<?= $jsRedir ?>);</script>
</body>
</html>
