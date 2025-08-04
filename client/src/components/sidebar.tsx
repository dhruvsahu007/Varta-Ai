import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Hash, 
  Plus, 
  Users, 
  Settings, 
  Brain, 
  FileText, 
  TrendingUp,
  Circle,
  LogOut,
  User as UserIcon
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Channel, User, InsertChannel } from "@shared/schema";

interface SidebarProps {
  selectedChannel: number | null;
  selectedDmUser: number | null;
  onChannelSelect: (channelId: number) => void;
  onDmUserSelect: (userId: number) => void;
}

// Modernized Sidebar: improved layout, spacing, icons, and mobile support
export function Sidebar({ 
  selectedChannel, 
  selectedDmUser, 
  onChannelSelect, 
  onDmUserSelect 
}: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState<string>("");
  const [isPrivateChannel, setIsPrivateChannel] = useState(false);

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
  });

  const { data: dmUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/direct-message-users"],
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: Omit<InsertChannel, "createdBy">) => {
      const res = await apiRequest("POST", "/api/channels", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      setIsChannelModalOpen(false);
      setChannelName("");
      setChannelDescription("");
      setIsPrivateChannel(false);
      toast({
        title: "Channel Created",
        description: "New channel has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create channel. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-green-400";
      case "away": return "bg-yellow-400";
      case "busy": return "bg-red-400";
      default: return "bg-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    return <Circle className={`w-3 h-3 ${getStatusColor(status)} rounded-full`} />;
  };

  const handleCreateChannel = () => {
    const trimmedName = channelName.trim();
    const trimmedDescription = channelDescription?.trim();

    if (!trimmedName) {
      toast({
        title: "Channel Name Required",
        description: "Please enter a name for the channel.",
        variant: "destructive",
      });
      return;
    }

    createChannelMutation.mutate({
      name: trimmedName.toLowerCase().replace(/\s+/g, '-'),
      description: trimmedDescription || undefined,
      isPrivate: isPrivateChannel
    });
  };

  return (
    <aside className="w-64 bg-background border-r border-border flex flex-col min-h-screen transition-all duration-300">
      {/* Workspace Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-gradient-to-r from-primary/80 to-accent/80">
        <img src="/generated-icon.png" alt="Workspace Logo" className="w-10 h-10 rounded-lg shadow" />
        <div>
          <h1 className="font-bold text-lg text-foreground">Varta AI Workspace</h1>
          <span className="flex items-center gap-1 text-xs text-green-400">
            <Circle className="w-2 h-2" /> AI Brain Active
          </span>
        </div>
      </div>
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2 tracking-wider">Channels</h2>
          <ul className="space-y-1">
            {channels.map((channel) => (
              <li key={channel.id}>
                <Button
                  variant={selectedChannel === channel.id ? 'secondary' : 'ghost'}
                  className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-md transition-colors"
                  onClick={() => onChannelSelect(channel.id)}
                  aria-current={selectedChannel === channel.id}
                >
                  <Hash className="h-4 w-4 text-primary" />
                  <span className="truncate">{channel.name}</span>
                  {channel.isPrivate && <Lock className="h-3 w-3 ml-1 text-muted-foreground" />}
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2 tracking-wider">Direct Messages</h2>
          <ul className="space-y-1">
            {dmUsers.map((user) => (
              <li key={user.id}>
                <Button
                  variant={selectedDmUser === user.id ? 'secondary' : 'ghost'}
                  className="w-full flex items-center gap-2 justify-start px-3 py-2 rounded-md transition-colors"
                  onClick={() => onDmUserSelect(user.id)}
                  aria-current={selectedDmUser === user.id}
                >
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback>{user.displayName?.[0]}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{user.displayName}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2 tracking-wider">AI Tools</h2>
          <ul className="space-y-1">
            <li>
              <Button variant="ghost" className="w-full flex items-center gap-2">
                <Brain className="h-4 w-4 text-blue-400" /> Org Memory
              </Button>
            </li>
            <li>
              <Button variant="ghost" className="w-full flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-400" /> Meeting Notes
              </Button>
            </li>
            <li>
              <Button variant="ghost" className="w-full flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-400" /> Tone Analytics
              </Button>
            </li>
          </ul>
        </div>
      </nav>
      {/* User Profile */}
      <div className="p-4 border-t border-border flex items-center gap-3 bg-muted/40">
        <Avatar>
          <AvatarImage src={user?.avatar} />
          <AvatarFallback>{user?.username?.[0]}</AvatarFallback>
        </Avatar>
        <div>
          <span className="block font-medium text-foreground">{user?.displayName}</span>
          <span className="block text-xs text-muted-foreground">{user?.username}</span>
        </div>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={logoutMutation.mutate} aria-label="Log out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Create Channel Modal */}
      <Dialog open={isChannelModalOpen} onOpenChange={setIsChannelModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Channel</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a new channel to your workspace
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="channel-name" className="text-white">Channel Name</Label>
              <Input
                id="channel-name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g. project-updates"
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="channel-description" className="text-white">Description</Label>
              <Textarea
                id="channel-description"
                value={channelDescription}
                onChange={(e) => setChannelDescription(e.target.value)}
                placeholder="What's this channel about?"
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="private-channel"
                checked={isPrivateChannel}
                onCheckedChange={setIsPrivateChannel}
              />
              <Label htmlFor="private-channel" className="text-white">Private Channel</Label>
            </div>
            <Button
              onClick={handleCreateChannel}
              disabled={createChannelMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {createChannelMutation.isPending ? (
                <>Creating...</>
              ) : (
                <>Create Channel</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Profile/Settings Modal */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center space-x-2">
              <UserIcon className="h-5 w-5" />
              <span>User Profile & Settings</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Manage your profile and account settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Profile Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Profile Information</h3>
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user?.avatar || undefined} />
                  <AvatarFallback className="bg-slate-600 text-white text-lg">
                    {user?.displayName?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <p className="text-white font-medium">{user?.displayName}</p>
                  <p className="text-slate-400 text-sm">@{user?.username}</p>
                  <p className="text-slate-400 text-sm">{user?.email}</p>
                </div>
              </div>
            </div>

            <Separator className="bg-slate-700" />

            {/* Status Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Status</h3>
              <div className="flex items-center space-x-2">
                <Circle className={`h-3 w-3 fill-current ${
                  user?.status === 'available' ? 'text-green-400' :
                  user?.status === 'busy' ? 'text-red-400' :
                  user?.status === 'away' ? 'text-yellow-400' :
                  'text-gray-400'
                }`} />
                <span className="text-slate-300 capitalize">{user?.status}</span>
              </div>
              {user?.title && (
                <p className="text-slate-400 text-sm">{user.title}</p>
              )}
            </div>

            <Separator className="bg-slate-700" />

            {/* Account Actions */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Account</h3>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-700 text-slate-300 hover:text-white"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    // TODO: Add edit profile functionality
                    toast({
                      title: "Coming Soon",
                      description: "Profile editing will be available in a future update.",
                    });
                  }}
                >
                  <UserIcon className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    logoutMutation.mutate();
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
