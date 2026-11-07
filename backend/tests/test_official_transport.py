from app.services.official_transport import parse_timetable


def test_iett_direction_and_day_columns_are_not_mixed():
    html = '<table><tr><th colspan="3">BEBEK KALKIŞ</th></tr><tr><th>İş Günleri</th><th>Cumartesi</th><th>Pazar</th></tr><tr><td>06:30</td><td>10:30</td><td>10:45</td></tr><tr><td>23:00</td><td>22:00</td><td>22:15</td></tr></table>'
    s = parse_timetable(html)[0]
    assert s["direction"] == "BEBEK KALKIŞ"
    assert s["days"]["weekday"]["times"] == ["06:30", "23:00"]
    assert s["days"]["saturday"]["last"] == "22:00"
    assert s["days"]["sunday"]["first"] == "10:45"


def test_empty_weekday_column_is_not_copied_from_weekend():
    html = '<table><tr><th>BEBEK KALKIŞ</th></tr><tr><th>İş Günleri</th><th>Cumartesi</th><th>Pazar</th></tr><tr><td></td><td>10:30</td><td>10:45</td></tr></table>'
    assert "weekday" not in parse_timetable(html)[0]["days"]
    assert parse_timetable("<html>Şu anda veri yok</html>") == []
