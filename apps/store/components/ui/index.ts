import type { MDXComponents } from "mdx/types";
import * as Accordion from "./accordion";
import * as Alert from "./alert";
import * as AlertDialog from "./alert-dialog";
import * as AspectRatio from "./aspect-ratio";
import * as Avatar from "./avatar";
import * as Badge from "./badge";
import * as Breadcrumb from "./breadcrumb";
import { Button } from "./button";
import * as ButtonGroup from "./button-group";
import * as Calendar from "./calendar";
import * as Card from "./card";
import * as Carousel from "./carousel";
import * as Chart from "./chart";
import * as Checkbox from "./checkbox";
import * as Collapsible from "./collapsible";
import * as Combobox from "./combobox";
import * as Command from "./command";
import * as ContextMenu from "./context-menu";
import * as Dialog from "./dialog";
import * as Drawer from "./drawer";
import * as DropdownMenu from "./dropdown-menu";
import * as Empty from "./empty";
import * as Field from "./field";
import * as HoverCard from "./hover-card";
import * as Input from "./input";
import * as InputGroup from "./input-group";
import * as InputOtp from "./input-otp";
import * as Item from "./item";
import * as Kbd from "./kbd";
import * as Label from "./label";
import * as Menubar from "./menubar";
import * as NavigationMenu from "./navigation-menu";
import * as Pagination from "./pagination";
import * as Popover from "./popover";
import * as Progress from "./progress";
import * as RadioGroup from "./radio-group";
import * as Resizable from "./resizable";
import * as ScrollArea from "./scroll-area";
import * as Select from "./select";
import * as Separator from "./separator";
import * as Sheet from "./sheet";
import * as Sidebar from "./sidebar";
import * as Skeleton from "./skeleton";
import * as Slider from "./slider";
import * as Sonner from "./sonner";
import * as Spinner from "./spinner";
import * as Switch from "./switch";
import * as Table from "./table";
import * as Tabs from "./tabs";
import * as Textarea from "./textarea";
import * as Toggle from "./toggle";
import * as ToggleGroup from "./toggle-group";
import * as Tooltip from "./tooltip";

export default {
	...Accordion,
	...Alert,
	...AlertDialog,
	...AspectRatio,
	...Avatar,
	...Badge,
	...Breadcrumb,
	Button,
	...ButtonGroup,
	...Calendar,
	...Card,
	...Carousel,
	...Chart,
	...Checkbox,
	...Collapsible,
	...Combobox,
	...Command,
	...ContextMenu,
	...Dialog,
	...Drawer,
	...DropdownMenu,
	...Empty,
	...Field,
	...HoverCard,
	...Input,
	...InputGroup,
	...InputOtp,
	...Item,
	...Kbd,
	...Label,
	...Menubar,
	...NavigationMenu,
	...Pagination,
	...Popover,
	...Progress,
	...RadioGroup,
	...Resizable,
	...ScrollArea,
	...Select,
	...Separator,
	...Sheet,
	...Sidebar,
	...Skeleton,
	...Slider,
	...Sonner,
	...Spinner,
	...Switch,
	...Table,
	...Tabs,
	...Textarea,
	...Toggle,
	...ToggleGroup,
	...Tooltip,
} satisfies MDXComponents;
