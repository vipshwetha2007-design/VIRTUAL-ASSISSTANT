from enum import IntFlag

import comtypes.gen._00020430_0000_0000_C000_000000000046_0_2_0 as __wrapper_module__
from comtypes.gen._00020430_0000_0000_C000_000000000046_0_2_0 import (
    IUnknown, IFontDisp, dispid, GUID, Monochrome, IPictureDisp,
    OLE_ENABLEDEFAULTBOOL, FONTNAME, VARIANT_BOOL, OLE_YSIZE_HIMETRIC,
    BSTR, FONTUNDERSCORE, Default, StdFont, OLE_YPOS_PIXELS,
    DISPPARAMS, IFontEventsDisp, OLE_YPOS_CONTAINER, Checked,
    typelib_path, _check_version, HRESULT, Font, CoClass, FONTSIZE,
    OLE_YSIZE_PIXELS, OLE_XPOS_CONTAINER, OLE_YPOS_HIMETRIC, Library,
    IPicture, FontEvents, _lcid, OLE_XSIZE_PIXELS, OLE_COLOR,
    OLE_OPTEXCLUSIVE, FONTITALIC, Picture, StdPicture,
    FONTSTRIKETHROUGH, OLE_YSIZE_CONTAINER, OLE_CANCELBOOL, EXCEPINFO,
    DISPMETHOD, OLE_XPOS_PIXELS, FONTBOLD, DISPPROPERTY, IEnumVARIANT,
    OLE_HANDLE, Unchecked, OLE_XPOS_HIMETRIC, IDispatch,
    OLE_XSIZE_CONTAINER, IFont, VgaColor, Gray, OLE_XSIZE_HIMETRIC,
    Color, COMMETHOD
)


class LoadPictureConstants(IntFlag):
    Default = 0
    Monochrome = 1
    VgaColor = 2
    Color = 4


class OLE_TRISTATE(IntFlag):
    Unchecked = 0
    Checked = 1
    Gray = 2


__all__ = [
    'OLE_XSIZE_PIXELS', 'IFontDisp', 'OLE_COLOR', 'OLE_OPTEXCLUSIVE',
    'OLE_TRISTATE', 'FONTITALIC', 'Picture', 'StdPicture',
    'FONTSTRIKETHROUGH', 'OLE_YSIZE_CONTAINER', 'OLE_CANCELBOOL',
    'Monochrome', 'IPictureDisp', 'OLE_ENABLEDEFAULTBOOL', 'FONTNAME',
    'LoadPictureConstants', 'OLE_XPOS_PIXELS', 'FONTBOLD',
    'OLE_YSIZE_HIMETRIC', 'FONTUNDERSCORE', 'Default', 'StdFont',
    'OLE_HANDLE', 'OLE_YPOS_PIXELS', 'IFontEventsDisp', 'Unchecked',
    'FontEvents', 'OLE_YPOS_CONTAINER', 'OLE_XPOS_HIMETRIC',
    'OLE_XSIZE_CONTAINER', 'typelib_path', 'Checked', 'IFont',
    'VgaColor', 'Font', 'Gray', 'FONTSIZE', 'OLE_YSIZE_PIXELS',
    'OLE_XPOS_CONTAINER', 'OLE_YPOS_HIMETRIC', 'Library', 'IPicture',
    'OLE_XSIZE_HIMETRIC', 'Color'
]

